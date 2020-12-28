import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract } from 'ethers'

/**
 * Assert vs expect vs should: https://stackoverflow.com/questions/21396524/what-is-the-difference-between-assert-expect-and-should-in-chai#21405128
 */

// Helper Contracts
let accounts,
  contractCreatorAddress,
  otherUserAddress,
  userAddress,
  tokenFactoryContract

// Constants
// const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

// Contract variables
let tokenFactory: Contract
let phmTokenAddress: string
let collateralAddress: string
let phmContract: Contract

// PHPM Token Details
const tokenDetails = {
  name: 'Mochi PH Token',
  symbol: 'PHPM',
  decimals: '18'
}

// Collaeral details
const collateralTokenDetails = {
  name: 'DAI Stable Token',
  symbol: 'DAI',
  decimals: '18'
}

const collateralToMint = 3333

before(async () => {
  // define signers
  accounts = await ethers.getSigners()
  contractCreatorAddress = accounts[0]
  userAddress = accounts[1]
  otherUserAddress = accounts[2]

  // create the collateral token (this should be the existing DAI contract not created by us)
  it('Can deploy and get ref to DAI Contract', async () => {
    // Deploy and mint Collateral Dai Contract
    // Get a reference of ERC20 Contract Factory
    const DaiContract = await ethers.getContractFactory('ExpandedERC20')

    // Deploy DAI with constructors
    const dai = await DaiContract.deploy(
      collateralTokenDetails.name,
      collateralTokenDetails.symbol,
      collateralTokenDetails.decimals
    )
    // Wait for dai to be deploy
    await dai.deployed()

    // (to check) assign dai address
    collateralAddress = dai.address

    // add address as minter - contractCreatorAddress not automatically added as minter for some reason
    await dai.addMinter(contractCreatorAddress.address)

    // mint token
    await dai.mint(contractCreatorAddress.address, collateralToMint)

    // get balance
    const daiBalance = BigNumber.from(
      await dai.balanceOf(contractCreatorAddress.address)
    ).toNumber()

    // test if values are equal
    expect(daiBalance).to.be.equal(
      collateralToMint,
      'contract creator ' +
        contractCreatorAddress.address +
        ' does not have expected balance of ' +
        collateralToMint
    )
  })

  // create the TokenFactory (existing contract by UMA not us)
  it('Can deploy and get ref to TokenFactory', async () => {
    // get an instance of TokenFactory
    tokenFactoryContract = await ethers.getContractFactory('TokenFactory')

    // Reference ERC20 contract
    tokenFactory = await tokenFactoryContract.deploy()

    // deploy token factory contract in blockchain
    // let obj = await tokenFactory.deployed()
    // console.log('tokenFactory same as obj?', tokenFactory === obj)

    // check that token factory is not null
    expect(tokenFactory).to.not.be.null
  })

  // create the synthetic token (this should be created by UMA not us)
  it('Can deploy and get ref to PHM Contract', async () => {
    expect(tokenFactory).to.not.be.null

    // create token
    const tx = await tokenFactory.createToken(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      { from: contractCreatorAddress.address }
    )

    // check transaction receipt to obtain token's address
    const txReceipt = await tx.wait()
    const txReceiptEvent = txReceipt.events.pop()

    // store token address
    phmTokenAddress = txReceiptEvent.address

    phmContract = await ethers.getContractAt(
      'ExpandedERC20',
      phmTokenAddress,
      accounts[0]
    )

    // Check if created token is equal to token being called
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

  it('Can deploy and get ref to Minter Contract', async () => {})
})
beforeEach(async () => {})
describe('Can accept DAI collateral', async () => {
  it('Can deposit DAI into Minter and receive PHM back', async () => {})
})
describe('Can transfer synth to recipient wallet', () => {})
describe('Can redeem synth for DAI collateral', () => {})
describe('Can earn HALO upon synth mint', () => {})
describe('Can earn HALO on transfer to whitelisted AMM address', () => {})
