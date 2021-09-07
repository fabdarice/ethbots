#!/usr/bin/env node

require('dotenv').config()
const fs = require('fs')
const { ethers } = require('ethers')

const abi = require('./abi.json')

const args = require('minimist')(process.argv.slice(2))
const RPC_URI = process.env.RPC_URI
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const PRIVATE_KEY = process.env.PRIVATE_KEY
const MULTIPLIER = args['multiplier'] || 2

if (require.main == module) {
  main()
}

// Main function
async function main() {
  preChecks()
  const provider = connectProvider()
  const contract = getContract(provider)
  console.log("Multiplier:", MULTIPLIER)

  while (true) {
    console.log('---------------------------------------------')
    await doSth(provider, contract)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Minting function
async function doSth(provider, contract) {
  try {
    const attemptPriorityFee = await calculatePriority(provider)
    console.log('Checking if mintToken would succeed..' )

    const txValue = {
      value: ethers.utils.parseEther('0.07'),
      maxPriorityFeePerGas: attemptPriorityFee.toHexString()
    }

    await contract.callStatic.mintTokens(1, txValue)
    console.log('It should work! Attempting mintToken for real...')
    const tx = await contract.mintTokens(1, txValue)
    console.log(`Transaction sent: https://etherscan.io/tx/${tx.hash}`)
    process.exit(1)
  } catch (e) {
    console.log(e['errorArgs'])
  }
}

async function calculatePriority(provider) {
    const feeData = await provider.getFeeData()
    const baseFee = feeData.maxFeePerGas.sub(feeData.maxPriorityFeePerGas)
    console.log('Current Base Fee (Gwei): ', ethers.utils.formatUnits(baseFee, 'gwei'))
    console.log('Current Priority Fee (Gwei): ', ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei'))
    const attemptPriorityFee = feeData.maxPriorityFeePerGas.mul(MULTIPLIER)
    console.log('Trying Priority Fee (Gwei): ', ethers.utils.formatUnits(attemptPriorityFee, 'gwei'))
    return attemptPriorityFee
}

function connectProvider() {
  console.log(`Connected to ${RPC_URI}`)
  const provider = new ethers.providers.JsonRpcProvider(RPC_URI)
  return provider
}

function getContract(provider) {
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`)
  return new ethers.Contract(CONTRACT_ADDRESS, abi, wallet)
}

function preChecks() {
  if (!RPC_URI) {
    console.log("RPC_URI not defined in .env")
    process.exit(1)

  }

  if (!CONTRACT_ADDRESS) {
    console.log('CONTRACT_ADDRESS not defined in .env')
    process.exit(1)
  }

  if (!PRIVATE_KEY) {
    console.log('PRIVATE_KEY not defined in .env')
    process.exit(1)
  }
}

