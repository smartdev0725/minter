require('dotenv').config()

import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-ethers'
import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || ''
const MNEMONIC_SEED = process.env.MNEMONIC_SEED || ''
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || ''

task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(await account.address)
  }
})

const config: HardhatUserConfig = {
  solidity: '0.6.12',

  networks: {
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: {
        mnemonic: MNEMONIC_SEED
      },
      gasPrice: 50000000000
    },
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    localhost: {
      chainId: 1337,
      url: 'http://127.0.0.1:9545'
    }
  }
}

export default config
