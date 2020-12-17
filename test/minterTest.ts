import { ethers } from 'hardhat'
import { expect } from 'chai'
import { BigNumber } from 'ethers'

describe('Generate a synthetic token with TokenFactory', async () => {
  // Helper Contracts
  let accounts, contractCreatorAddress, otherUserAddress, userAddress, contract

  // Constants
  // const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

  // Contract variables
  let tokenFactory
  let phpmTokenAddress
  let collateralAddress
  let phpmContract

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

  const collateralMinted = 3333

  before(async function () {
    // get an instance of TokenFactory
    contract = await ethers.getContractFactory('TokenFactory')

    // define signers
    accounts = await ethers.getSigners()
    contractCreatorAddress = accounts[0]
    userAddress = accounts[1]
    otherUserAddress = accounts[2]

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

    // Reference ERC20 contract
    tokenFactory = await contract.deploy()

    // deploy token factory contract in blockchain
    await tokenFactory.deployed()

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
  })

  it('creates the phpm contract successfully', async () => {
    // Make an instance of the token deployed by the token factory
    phpmContract = await ethers.getContractAt(
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
  })

  it('mints 100 PHPM ', async () => {
    // test values
    let afterMint = 100
    let beforeMint = 0

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

    // wait for the transaction to be processed/mined
    await tx.wait()

    // CHeck if mint is successful
    expect(
      BigNumber.from(
        await phpmContract.balanceOf(contractCreatorAddress.address)
      ).toNumber()
    ).to.be.equal(afterMint)
  })

  it('deposits collateral in minter contract', async () => {
    // TODO: Working in progress, only return event for now and doesnt do collateral deposit yet
    const depositContract = await ethers.getContractFactory('Minter')

    const deployedDepositContract = await depositContract.deploy()

    await deployedDepositContract.deployed()

    //console.log('Deposit Contract address: ', deployedDepositContract.address)

    await deployedDepositContract.initialize()
    const deposit = await deployedDepositContract.deposit(1000)
    const txReceipt = await deposit.wait()

    //console.log(txReceipt)

    expect(txReceipt.events[0].event === 'Deposit')

    //console.log('event: ', txReceiptEvent)
    //  console.log(
    //    ethers.utils.defaultAbiCoder.decode(['string'], txReceiptEvent.data)
    //  )
    //  const eventTopic = deployedDepositContract.filters.Deposit()

    // console.log(ethers.utils.hexlify(eventTopic.topics))
  })
})

describe('Can transfer synth to recipient wallet', () => {})

/**
 * 
  beforeEach(async () => {})
  describe('Synthetic is minted', () => {}) -- DONE
  describe('Can accept DAI collateral', () => {}) -- DONE
  describe('Can redeem synth for DAI collateral', () => {})
  describe('Can earn HALO upon synth mint', () => {})
  describe('Can earn HALO on transfer to whitelisted AMM address', () => {})
})
 */
