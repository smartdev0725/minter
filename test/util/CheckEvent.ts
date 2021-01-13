import { ethers } from 'hardhat'

import { BigNumber, Contract } from 'ethers'
import { expect } from 'chai'
import {
  BurnEvent,
  DepositedCollateralEvent,
  MintEvent,
  WithdrawnCollateralEvent
} from '../types/types'

export const checkDepositEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValue: number
): Promise<boolean> => {
  let depositEvent = new Promise<DepositedCollateralEvent>(
    (resolve, reject) => {
      console.log('depositing')
      contract.on(
        'DepositedCollateral',
        (user, collateral, collateralAddress) => {
          resolve({
            user: user,
            collateral: collateral,
            collateralAddress: collateralAddress
          })
        }
      )

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    }
  )
  const event = await depositEvent

  console.log(`${event.user}, ${event.collateral} , ${event.collateralAddress}`)
  expect(event.user).to.be.equal(sender)
  expect(event.collateral).to.be.equal(collateralValue)
  expect(event.collateralAddress).to.be.equal(address)
  contract.removeAllListeners()

  return true
}

export const checkWithdrawalEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValue: number
): Promise<boolean> => {
  let withdrawalEvent = new Promise<WithdrawnCollateralEvent>(
    (resolve, reject) => {
      contract.on(
        'WithdrawnCollateral',
        (user, collateral, collateralAddress) => {
          resolve({
            user: user,
            collateral: collateral,
            collateralAddress: collateralAddress
          })
        }
      )

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    }
  )
  const event = await withdrawalEvent
  console.log(`${event.user}, ${event.collateral} , ${event.collateralAddress}`)
  expect(event.user).to.be.equal(sender)
  expect(event.collateral).to.be.equal(collateralValue)
  expect(event.collateralAddress).to.be.equal(address)
  contract.removeAllListeners()

  return true
}

export const checkMintEvent = async (
  contract: Contract,
  sender: string,
  collateralValue: number
): Promise<boolean> => {
  const mintEvent = new Promise<MintEvent>((resolve, reject) => {
    contract.on('Mint', (user, value) => {
      resolve({
        user: user,
        value: value
      })
    })

    setTimeout(() => {
      reject(new Error('timeout'))
    }, 60000)
  })

  const event = await mintEvent
  console.log(event.user)
  expect(event.user).to.be.equal(sender)
  expect(event.value).to.be.equal(collateralValue)
  contract.removeAllListeners()

  return true
}

export const checkBurnEvent = async (
  contract: Contract,
  sender: string,
  collateralValue: number
): Promise<boolean> => {
  const burnEvent = new Promise<BurnEvent>((resolve, reject) => {
    contract.on('Mint', (user, value) => {
      resolve({
        user: user,
        value: value
      })
    })

    setTimeout(() => {
      reject(new Error('timeout'))
    }, 60000)
  })

  const event = await burnEvent
  console.log(event.user)
  expect(event.user).to.be.equal(sender)
  expect(event.value).to.be.equal(collateralValue)
  contract.removeAllListeners()

  return true
}
