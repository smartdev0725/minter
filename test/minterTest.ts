import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract, ContractFactory } from 'ethers'

/**
 * Assert vs expect vs should: https://stackoverflow.com/questions/21396524/what-is-the-difference-between-assert-expect-and-should-in-chai#21405128
 * we are going with expect for now
 *
 * Our pattern for deploying and expect-ing Contract objects is as follows:
 * 1. Declare ContractFactory object
 * 2. Declare Contract object
 * 3. 'Deploy and get reference test' by;
 *      a. ethers.getContractFactory
 *      b. ContractFactory.deploy()
 *      c. Contract.deployed()
 *      d. test for expected Contract properties
 *      e. test for expected Contract property values
 */

// Helper vars
let accounts,
  otherUserAddress: string,
  userAddress: string,
  collateralAddress: string,
  phmTokenAddress: string

// account that signs deploy txs
let contractCreatorAccount: SignerWithAddress

// Constants
// const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

// ContractFactory variables that do initial deployment
let tokenFactoryContractFactory: ContractFactory,
  minterFactoryContract: ContractFactory,
  daiContractFactory: ContractFactory

// Contract variables that store deployed Contracts
let tokenFactoryContract: Contract,
  phmContract: Contract,
  minterContract: Contract,
  daiContract: Contract

// PHM Token Details
const tokenDetails = {
  name: 'Mochi PH Token',
  symbol: 'PHM',
  decimals: '18'
}

// Fake DAI Collaeral details
const collateralTokenDetails = {
  name: 'DAI Dummy Token',
  symbol: 'DAI',
  decimals: '18'
}

const collateralToMint = 3333

// single run per test setup
before(async () => {
  // define signers
  accounts = await ethers.getSigners()
  contractCreatorAccount = accounts[0]
  userAddress = accounts[1]
  otherUserAddress = accounts[2]

  // create the collateral token (this should be the existing DAI contract not created by us)
  it('Can deploy and get ref to DAI Contract', async () => {
    // Deploy and mint Collateral Dai Contract
    // Get a reference of ERC20 Contract Factory
    daiContractFactory = await ethers.getContractFactory('ExpandedERC20')

    /**
     * Deploy with constructors
     * not using Contract.deployed() cause .deploy() allows for smart contract ctor arguments
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762
     *  */
    daiContract = await daiContractFactory.deploy(
      collateralTokenDetails.name,
      collateralTokenDetails.symbol,
      collateralTokenDetails.decimals
    )

    /**
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762 checks deployed, deploys otherwise
     *  */
    daiContract = await daiContract.deployed()

    /**
     * check that contract is indeed of type Contract
     * https://docs.ethers.io/v5/api/contract/contract/#Contract--properties
     */
    expect(daiContract).to.have.property('address')
    expect(daiContract).to.have.property('interface')
    expect(daiContract).to.have.property('provider')
    expect(daiContract.address).to.be.a(
      'string',
      'daiContract.address not of expected type string'
    )

    // Check if created token indeed has expected token details
    expect(await daiContract.name()).to.be.equal(
      collateralTokenDetails.name,
      'dai name not as expected'
    )
    expect(await daiContract.symbol()).to.be.equal(
      collateralTokenDetails.symbol,
      'dai symbol not as expected'
    )
    expect((await daiContract.decimals()).toString()).to.be.equal(
      collateralTokenDetails.decimals,
      'dai decimals not as expected'
    )

    // (to check) assign dai address
    collateralAddress = daiContract.address

    // add address as minter - contractCreatorAddress not automatically added as minter for some reason
    await daiContract.addMinter(contractCreatorAccount.address)

    // mint token
    await daiContract.mint(contractCreatorAccount.address, collateralToMint)

    // get balance
    const daiBalance = BigNumber.from(
      await daiContract.balanceOf(contractCreatorAccount.address)
    ).toNumber()

    // test if values are equal
    expect(daiBalance).to.be.equal(
      collateralToMint,
      'contract creator ' +
        contractCreatorAccount.address +
        ' does not have expected balance of ' +
        collateralToMint
    )
  })

  // create the TokenFactory (existing contract by UMA not us)
  it('Can deploy and get ref to TokenFactory', async () => {
    // get an instance of TokenFactory
    tokenFactoryContractFactory = await ethers.getContractFactory(
      'TokenFactory'
    )

    /**
     * Deploy with constructors
     * not using Contract.deployed() cause .deploy() allows for smart contract ctor arguments
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762
     *  */
    tokenFactoryContract = await tokenFactoryContractFactory.deploy()

    /**
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762 checks deployed, deploys otherwise
     *  */
    tokenFactoryContract = await tokenFactoryContract.deployed()

    /**
     * check that contract is indeed of type Contract
     * https://docs.ethers.io/v5/api/contract/contract/#Contract--properties
     */
    expect(tokenFactoryContract).to.have.property('address')
    expect(tokenFactoryContract).to.have.property('interface')
    expect(tokenFactoryContract).to.have.property('provider')
    expect(tokenFactoryContract.address).to.be.a(
      'string',
      'tokenFactoryContract.address not of expected type string'
    )
  })

  // create the synthetic token (this should be created by UMA not us)
  it('Can deploy and get ref to PHM Contract', async () => {
    expect(tokenFactoryContract).to.not.be.null

    // create token
    const tx = await tokenFactoryContract.createToken(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      { from: contractCreatorAccount.address }
    )

    // check transaction receipt to obtain token's address
    const txReceipt = await tx.wait()
    const txReceiptEvent = txReceipt.events.pop()

    // store token address
    phmTokenAddress = txReceiptEvent.address

    /**
     * get contract prev deployed by tokenFactory using address and account[0] as signer
     */
    phmContract = await ethers.getContractAt(
      'ExpandedERC20',
      phmTokenAddress,
      accounts[0]
    )

    /**
     * check that contract is indeed of type Contract
     * https://docs.ethers.io/v5/api/contract/contract/#Contract--properties
     */
    expect(phmContract).to.have.property('address')
    expect(phmContract).to.have.property('interface')
    expect(phmContract).to.have.property('provider')
    expect(phmContract.address).to.be.a(
      'string',
      'phmContract.address not of expected type string'
    )

    // Check if created token indeed has expected token details
    expect(await phmContract.name()).to.be.equal(
      tokenDetails.name,
      'token name not as expected'
    )
    expect(await phmContract.symbol()).to.be.equal(
      tokenDetails.symbol,
      'token symbol not as expected'
    )
    expect((await phmContract.decimals()).toString()).to.be.equal(
      tokenDetails.decimals,
      'token decimals not as expected'
    )
  })

  it('Can deploy and get ref to Minter Contract', async () => {
    // get an instance of Minter
    minterFactoryContract = await ethers.getContractFactory('Minter')

    /**
     * Deploy with constructors
     * not using Contract.deployed() cause .deploy() allows for smart contract ctor arguments
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762
     *  */
    minterContract = await minterFactoryContract.deploy()

    /**
     * https://github.com/ethers-io/ethers.js/blob/master/packages/contracts/src.ts/index.ts#L762 checks deployed, deploys otherwise
     *  */
    minterContract = await minterContract.deployed()

    /**
     * check that contract is indeed of type Contract
     * https://docs.ethers.io/v5/api/contract/contract/#Contract--properties
     */
    expect(minterContract).to.have.property('address')
    expect(minterContract).to.have.property('interface')
    expect(minterContract).to.have.property('provider')
    expect(minterContract.address).to.be.a(
      'string',
      'minterContract.address not of expected type string'
    )
  })
})
beforeEach(async () => {})
describe('Can accept DAI collateral', async () => {
  it('Can deposit DAI into Minter and receive PHM back', async () => {})
})
describe('Can transfer synth to recipient wallet', () => {})
describe('Can redeem synth for DAI collateral', () => {})
describe('Can earn HALO upon synth mint', () => {})
describe('Can earn HALO on transfer to whitelisted AMM address', () => {})
