import { ethers } from 'hardhat'

import { Contract } from 'ethers'

export const checkDepositEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValue: number
): Promise<boolean> => {
  let count = 0
  let listener = new Promise<void>((resolve, reject) => {
    try {
      contract.on(
        contract.filters.DepositedCollateral(sender),
        (user, collateral, collateralAddress) => {
          if (
            user == sender &&
            collateral == collateralValue &&
            address == collateralAddress
          ) {
            count += 1
          }

          resolve()
        }
      )
    } catch (err) {
      console.error(err)
      reject()
    }
  })

  await listener
  if (count > 0) {
    return true
  } else {
    return false
  }
}

export const checkWithdrawalEvent = async (
  contract: Contract,
  sender: string,
  address: string,
  collateralValue: number
): Promise<boolean> => {
  let count = 0
  let listener = new Promise<void>((resolve, reject) => {
    try {
      contract.on(
        contract.filters.WithdrawnCollateral(sender),
        (user, collateral, collateralAddress) => {
          if (
            user == sender &&
            collateral == collateralValue &&
            address == collateralAddress
          ) {
            count += 1
          }

          resolve()
        }
      )
    } catch (err) {
      console.error(err)
      reject()
    }
  })

  await listener
  if (count > 0) {
    return true
  } else {
    return false
  }
}
