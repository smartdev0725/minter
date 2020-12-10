require('dotenv').config()

import { HardhatUserConfig } from 'hardhat/types'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || ''
const MNEMONIC_SEED = process.env.MNEMONIC_SEED || ''
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || ''

const config: HardhatUserConfig = {
  solidity: '0.7.3',
  networks: {
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: {
        mnemonic: MNEMONIC_SEED
      }
    },
    hardhat: {
      chainId: 99
    }
  }
}

export default config
