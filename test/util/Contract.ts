/**
 * * Our pattern for deploying and expect-ing Contract objects is as follows:
 * 1. Declare ContractFactory object
 * 2. Declare Contract object
 * 3. 'Deploy and get reference test' by;
 *      a. ethers.getContractFactory
 *      b. test for expected ContractFactory properties
 *      b. ContractFactory.deploy()
 *      c. Contract.deployed()
 *      d. test for expected Contract properties
 *      e. test for expected Contract property values
 */

import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { TokenDetails } from '../types/types'
import { exception } from 'console'

/**
 *
 * @param contractName The name of the contract artifact
 * @param tokenDetails optional argument: the array of type TokenDetails containing the smart contract constructor argument
 */
const deployContract = async (
  contractName: string,
  tokenDetails?: TokenDetails
): Promise<Contract> => {
  let isValid = false
  // create contract factory
  let contractFactory = await ethers.getContractFactory(contractName)

  // check if contractFactory is a valid ContractFactory
  isValid = await isValidContractFactory(contractFactory)

  /**
   * Deploy (with constructors, ff tokenDetails param was passed)
   * not using Contract.deployed() cause .deploy() allows for smart contract ctor arguments
   * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762
   *  */
  let contract
  if (tokenDetails) {
    contract = await contractFactory.deploy(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals
    )
  } else {
    contract = await contractFactory.deploy()
  }

  /**
   * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762 checks deployed, deploys otherwise
   *  */
  contract = await contract.deployed()

  // check contract is a valid Contract
  isValid = await isValidContract(contract, contractName)

  // If tokenDetails param was passed, check if created token indeed has expected token details
  if (tokenDetails) {
    isValid = await isValidERC20(contractName, contract, tokenDetails)
  }

  if (isValid) return contract
  else throw exception(contractName + ' is not valid')
}

const isValidERC20 = async (
  contractName: string,
  contract: Contract,
  tokenDetails: TokenDetails
): Promise<boolean> => {
  expect(await contract.name()).to.be.equal(
    tokenDetails.name,
    contractName + ' name not as expected'
  )
  expect(await contract.symbol()).to.be.equal(
    tokenDetails.symbol,
    contractName + ' symbol not as expected'
  )
  expect((await contract.decimals()).toString()).to.be.equal(
    tokenDetails.decimals,
    contractName + ' decimals not as expected'
  )

  return true
}

const isValidContract = async (
  contract: Contract,
  contractName: string
): Promise<boolean> => {
  /**
   * check that contract is indeed of type Contract
   * https://docs.ethers.io/v5/api/contract/contract/#Contract--properties
   */
  expect(contract).to.not.be.null
  expect(contract).to.have.property('address')
  expect(contract).to.have.property('interface')
  expect(contract).to.have.property('provider')
  expect(contract).to.have.property('signer')

  // we only check that address is of a certain type because types specific to ethers lib don't seem to be recognised by Chai from the get go
  expect(contract.address).to.be.a(
    'string',
    contractName + '.address not of expected type string'
  )

  return true
}

const isValidContractFactory = async (
  contractFactory: ContractFactory
): Promise<boolean> => {
  /**
   * check that contractFactory is indeed of type ContractFactory
   * https://docs.ethers.io/v5/api/contract/contract-factory/
   */
  expect(contractFactory).to.not.be.null
  expect(contractFactory).to.have.property('bytecode')
  expect(contractFactory).to.have.property('interface')
  expect(contractFactory).to.have.property('signer')
  return true
}

export { deployContract, isValidERC20, isValidContract, isValidContractFactory }
