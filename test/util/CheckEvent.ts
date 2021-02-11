import { ethers } from 'hardhat'

import { BigNumber, Contract } from 'ethers'
import { expect } from 'chai'
import {
  BurnEvent,
  ChangedFinancialContractAddressEvent,
  DepositedCollateralEvent,
  MintEvent,
  WithdrawnCollateralEvent
} from '../types/types'
import { formatEther } from 'ethers/lib/utils'

export const checkDepositEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValueDeposit: BigNumber,
  tokensMinted: BigNumber
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
  console.log('Tokens minted: ', formatEther(eventMint.value))
  expect(eventMint.user).to.be.equal(sender)
  expect(eventMint.value).to.be.equal(tokensMinted)

  const eventDeposit = await depositEvent
  console.log('Collateral deposited: ', formatEther(eventDeposit.collateral))
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
  collateralValue: BigNumber,
  tokenToBurn: BigNumber
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
  console.log('Tokens burned: ', formatEther(eventBurn.value))
  expect(eventBurn.user).to.be.equal(sender)
  expect(eventBurn.value).to.be.equal(tokenToBurn)

  const eventWithdrawal = await withdrawalEvent
  console.log('Collateral: ', formatEther(eventWithdrawal.collateral))
  expect(eventWithdrawal.user).to.be.equal(sender)
  expect(eventWithdrawal.collateral).to.be.equal(collateralValue)
  expect(eventWithdrawal.collateralAddress).to.be.equal(address)
  contract.removeAllListeners()

  return true
}

export const checkChangedFinancialContractAddressEvent = async (
  contract: Contract,
  address: string
): Promise<boolean> => {
  let changedFinancialContractAddressEvent = new Promise<ChangedFinancialContractAddressEvent>(
    (resolve, reject) => {
      contract.on('WithdrawnCollateral', (newFinancialContractAddress) => {
        resolve({
          newFinancialContractAddress: newFinancialContractAddress
        })
      })

      setTimeout(() => {
        reject(new Error('timeout'))
      }, 60000)
    }
  )

  const eventChangedFinancialContractAddress = await changedFinancialContractAddressEvent
  expect(
    eventChangedFinancialContractAddress.newFinancialContractAddress
  ).to.be.equal(address)

  contract.removeAllListeners()

  return true
}
