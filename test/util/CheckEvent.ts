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
  collateralValueDeposit: BigNumber,
  collateralValueMint: BigNumber
): Promise<boolean> => {
  let depositEvent = new Promise<DepositedCollateralEvent>(
    (resolve, reject) => {
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

  const eventMint = await mintEvent
  expect(eventMint.user).to.be.equal(sender)
  expect(eventMint.value).to.be.equal(collateralValueMint)

  const eventDeposit = await depositEvent
  expect(eventDeposit.user).to.be.equal(sender)
  expect(eventDeposit.collateral).to.be.equal(collateralValueDeposit)
  expect(eventDeposit.collateralAddress).to.be.equal(address)

  contract.removeAllListeners()

  return true
}

export const checkWithdrawalEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValue: number,
  collateralToRedeem: number
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

  const burnEvent = new Promise<BurnEvent>((resolve, reject) => {
    contract.on('Burn', (user, value) => {
      resolve({
        user: user,
        value: value
      })
    })

    setTimeout(() => {
      reject(new Error('timeout'))
    }, 60000)
  })

  const eventBurn = await burnEvent
  expect(eventBurn.user).to.be.equal(sender)
  expect(eventBurn.value).to.be.equal(collateralToRedeem)

  const eventWithdrawal = await withdrawalEvent
  expect(eventWithdrawal.user).to.be.equal(sender)
  expect(eventWithdrawal.collateral).to.be.equal(collateralValue)
  expect(eventWithdrawal.collateralAddress).to.be.equal(address)
  contract.removeAllListeners()

  return true
}
