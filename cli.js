#!/usr/bin/env node

require('dotenv').config()
const fs = require('fs')
const { ethers } = require('ethers')

const abi = require('./abi.json')

const args = require('minimist')(process.argv.slice(2))
const RPC_URI = process.env.RPC_URI
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const PRIVATE_KEY = args['privKey'] || process.env.PRIVATE_KEY
const MULTIPLIER = args['multiplier'] || 2
const MAX_GAS_GWEI = args['maxGas'] || 1000
const MAX_GAS_WEI = ethers.utils.parseUnits(MAX_GAS_GWEI.toString(), 'gwei')
const TIP_GWEI = args['tip'] || 200
const TIP_WEI = ethers.utils.parseUnits(TIP_GWEI.toString(), 'gwei')
const DELAY_IN_MS = args['delay'] || 500

if (require.main == module) {
  main()
}

// Main function
async function main() {
  preChecks()
  const provider = connectProvider()
  const contract = getContract(provider)
  console.log("Multiplier:", MULTIPLIER)
  console.log(`Max Gas: ${ethers.utils.formatUnits(MAX_GAS_WEI, 'gwei')} Gwei`)
  console.log(`Tip: ${ethers.utils.formatUnits(TIP_WEI, 'gwei')} Gwei`)

  while (true) {
    console.log('---------------------------------------------')
    await mintToken(provider, contract)
    await new Promise(resolve => setTimeout(resolve, DELAY_IN_MS));
  }
}

// Minting function
async function mintToken(provider, contract) {
  try {
    const totalGas = await checkBelowMaxGas(provider)
    // Check that we're not going above MAX_GAS_WEI
    if (totalGas.gt(MAX_GAS_WEI)) {
      console.log(`Exit. Total Gas ${ethers.utils.formatUnits(totalGas, "gwei")} Gwei > MAX_GAS`)
      return
    }

    console.log('Checking if mintToken would succeed..' )
    await contract.callStatic.mintTokens(1, {
      value: ethers.utils.parseEther('0.07')
    })

    console.log('It should work! Attempting mintToken for real...')
    const tx = await contract.mintTokens(1, {
      value: ethers.utils.parseEther('0.07'),
      maxPriorityFeePerGas: TIP_WEI,
      maxFeePerGas: MAX_GAS_WEI
    })

    console.log(`Transaction sent: https://etherscan.io/tx/${tx.hash}`)
    process.exit(1)
  } catch (e) {
    if (e['errorArgs']) {
      console.log(e['errorArgs'])
    } else {
      if (e['error']['response']) {
        console.log(e['error']['response'])
      } else {
        console.log(e)
      }
    }
  }
}


async function checkBelowMaxGas(provider) {
  const feeData = await provider.getFeeData()
  const baseFee = feeData.maxFeePerGas.div(2)
  console.log(`Current Base Fee: ${ethers.utils.formatUnits(baseFee, 'gwei')} Gwei`)
  const totalGas = TIP_WEI.add(baseFee)

  console.log(`Attempting Total Gas: ${ethers.utils.formatUnits(totalGas, 'gwei')} Gwei `)
  return totalGas
}

function connectProvider() {
  console.log(`Connected to ${RPC_URI}`)
  const provider = new ethers.providers.WebSocketProvider(RPC_URI)
  return provider
}

function getContract(provider) {
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  console.log(`Using Wallet: ${wallet.address}`)
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

