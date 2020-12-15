/**
 * TokenFactory usage: https://github.com/UMAprotocol/protocol/blob/a0eacc42b2a0fde78ea1cf6ae0ce3923a6654930/packages/core/test/financial-templates/TokenFactory.js
 */

import { ethers } from 'hardhat'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { hexDataSlice } from 'ethers/lib/utils'

describe('Deploy TokenFactory', async () => {
  // Helper Contracts
  let accounts, contractCreatorAddress, otherUserAddress, userAddress, contract

  // Constants
  // const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

  // Contract variables
  let tokenFactory
  let phpmTokenAddress
  let collateralAddress

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

  before(async function () {
    // get an instance of TokenFactory
    contract = await ethers.getContractFactory('TokenFactory')

    // define signers
    accounts = await ethers.getSigners()
    contractCreatorAddress = accounts[0]
    userAddress = accounts[1]
    otherUserAddress = accounts[2]

    // Deploy Collateral Dai Contract
    // Reference ERC20 contract
    console.log('Contract Creator address: ', contractCreatorAddress.address)
    tokenFactory = await contract.deploy()

    // deploy token factory contract in blockchain
    await tokenFactory.deployed()

    console.log('Token Factory Address: ', tokenFactory.address)

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
    phpmTokenAddress = txReceiptEvent.address
    console.log('PHPM Address: ', phpmTokenAddress)

    // // now we can do stuff w PHPM
    // assert.isNotNull(phpToken, 'beforeEach: phpToken is null')
  })

  it('Creates a collateral token (DAI) and mints 3333 DAI', async () => {
    const collateralMinted = 3333

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

    // add address as minter
    await dai.addMinter(contractCreatorAddress.address)

    // mint token
    await dai.mint(contractCreatorAddress.address, collateralMinted)

    // get balance
    const daiBalance = BigNumber.from(
      await dai.balanceOf(contractCreatorAddress.address)
    ).toNumber()

    // test if values are equal
    expect(daiBalance).to.equal(collateralMinted)
  })

  it('mint 100 PHPM by contractCreator ', async () => {
    // test values
    let afterMint = 100
    let beforeMint = 0

    // Make an instance of the token deployed by the token factory
    const phpmContract = await ethers.getContractAt(
      'ExpandedERC20',
      phpmTokenAddress,
      contractCreatorAddress.address
    )

    // Check if created token is equal to token being called
    expect(await phpmContract.name()).to.be.equal(tokenDetails.name)
    expect(await phpmContract.symbol()).to.be.equal(tokenDetails.symbol)
    expect((await phpmContract.decimals()).toString()).to.be.equal(
      tokenDetails.decimals
    )

    // Check if  balance is zero before minting
    expect(
      BigNumber.from(
        await phpmContract.balanceOf(contractCreatorAddress.address)
      ).toNumber()
    ).to.be.equal(beforeMint)

    const tx = await phpmContract.mint(
      contractCreatorAddress.address,
      afterMint
    )

    await tx.wait()

    //console.log(txReceipt)

    // CHeck if mint is successful
    expect(
      BigNumber.from(
        await phpmContract.balanceOf(contractCreatorAddress.address)
      ).toNumber()
    ).to.be.equal(afterMint)
  })

  // it("Can take DAI deposit and mint PHPM", async () => {

  // });

  // it("PHPM can be redeemed for DAI by contractCreator", async () => {

  // });

  // it("New PHPM cannot be minted by non contractCreator", async () => {

  // });

  // it("New PHPM cannot be burnt by non contractCreator", async () => {

  // });
})
