import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract } from 'ethers'
import {
  deployContract,
  isValidContract,
  isValidContractFactory,
  isValidERC20
} from './util/DeployContract'
import {
  checkDepositEvent,
  checkMintEvent,
  checkWithdrawalEvent
} from './util/CheckEvent'
import { doesNotMatch } from 'assert'

/**
 * Assert vs expect vs should:
 * https://stackoverflow.com/questions/21396524/what-is-the-difference-between-assert-expect-and-should-in-chai#21405128
 * we are going with expect for now
 */

// Helper vars
let accounts,
  otherUserAddress: string,
  userAddress: SignerWithAddress,
  collateralAddress: string,
  nonCollateralAddress: string,
  expandedERC20LabelString: string = 'ExpandedERC20',
  tokenFactoryLabelString: string = 'TokenFactory',
  // name not as impt, since does not have an artifact to reference since auto deployed by TokenFactory
  phmContractLabelString: string = 'PHMContract',
  minterContractLabelString: string = 'Minter'

// account that signs deploy txs
let contractCreatorAccount: SignerWithAddress

// Constants
// const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

// Contract variables that store deployed Contracts
let tokenFactoryContract: Contract,
  phmContract: Contract,
  minterContract: Contract,
  daiContract: Contract,
  dumContract: Contract

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

// Fake DAI Collaeral details
const nonCollateralTokenDetails = {
  name: 'DUM Dummy Token',
  symbol: 'DUM',
  decimals: '18'
}

// constants
const collateralToMint = 3333
const collateralDeposit = 150
const expectedPHM = collateralDeposit * 50
const collateralToRedeem = 100
const expectedConvertedCollateral = 2

// single run per test setup
before(async () => {
  // define signers
  accounts = await ethers.getSigners()
  contractCreatorAccount = accounts[0]
  userAddress = accounts[1]
  otherUserAddress = accounts[2]

  // create the collateral token (this should be the existing DAI contract not created by us)
  it('Can deploy and get ref to DAI Contract', async () => {
    // deploy Contract with 'expect' assurances
    daiContract = await deployContract(
      expandedERC20LabelString,
      collateralTokenDetails
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
    tokenFactoryContract = await deployContract(tokenFactoryLabelString)
  })

  // create the synthetic token (this should be created by UMA not us)
  it('Can deploy and get ref to PHM Contract', async () => {
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

    /**
     * get contract prev deployed by tokenFactory using address and account[0] as signer
     */
    phmContract = await ethers.getContractAt(
      expandedERC20LabelString,
      txReceiptEvent.address,
      accounts[0]
    )

    // check if valid Contract obj
    await isValidContract(phmContract, 'expandedERC20LabelString')
    // check if valid ERC20 Contract obj
    await isValidERC20(phmContractLabelString, phmContract, tokenDetails)
  })

  it('Can deploy and get ref to Minter Contract', async () => {
    let contractFactory = await ethers.getContractFactory(
      minterContractLabelString
    )

    expect(await isValidContractFactory(contractFactory)).to.be.true

    minterContract = await contractFactory.deploy(phmContract.address)
    minterContract = await minterContract.deployed()

    expect(await isValidContract(minterContract, minterContractLabelString)).to
      .be.true

    await minterContract.initialize()

    // whitelist DAI collateral address
    await minterContract.addCollateralAddress(daiContract.address)

    // add  minterContract as minter
    await daiContract.addMinter(minterContract.address)

    // add minterContract as minter and burner of phm contract
    await phmContract.addMinter(minterContract.address)
    await phmContract.addBurner(minterContract.address)

    // approve contract to spend collateral tokens
    await daiContract.approve(minterContract.address, 10000)
    await phmContract.approve(minterContract.address, 10000)
    await phmContract.approve(contractCreatorAccount.address, 10000)
    await minterContract.approveCollateralSpend(daiContract.address, 10000)
  })

  it('Can deploy a non-collateral ERC token for testing', async () => {
    dumContract = await deployContract(
      expandedERC20LabelString,
      nonCollateralTokenDetails
    )

    // (to check) assign dai address
    nonCollateralAddress = dumContract.address

    // add address as minter - contractCreatorAddress not automatically added as minter for some reason
    await dumContract.addMinter(contractCreatorAccount.address)

    // mint token
    await dumContract.mint(contractCreatorAccount.address, collateralToMint)

    // get balance
    const dumBalance = BigNumber.from(
      await daiContract.balanceOf(contractCreatorAccount.address)
    ).toNumber()

    // test if values are equal
    expect(dumBalance).to.be.equal(
      collateralToMint,
      'contract creator ' +
        contractCreatorAccount.address +
        ' does not have expected balance of ' +
        collateralToMint
    )
  })
})

/**
 * TODO: test util funcs for events emitted after every state changing tx (Transfer, Mint, Burn, etc)
 * TODO: these tests are still an initial outline, can actually break these down into smaller fixtures
 * TODO: Need to think of every success/failure scenario
 */
describe('Can accept collateral and mint synthetic', async () => {
  beforeEach(async () => {})

  it('sending collateral ERC20 to deposit func should mint PHM, return PHM to msg.sender', async () => {
    // test if  contract has no collateral
    expect(
      BigNumber.from(
        await daiContract.balanceOf(minterContract.address)
      ).toNumber()
    ).to.be.equal(
      0,
      `contract ${minterContract.address} does not have expected balance of 0`
    )

    // deposit collateral to minter contract
    const depositTxn = await minterContract.depositByCollateralAddress(
      collateralDeposit,
      collateralAddress
    )

    await depositTxn.wait()

    // Check latest values from the contract so need to call again
    expect(
      BigNumber.from(
        await daiContract.balanceOf(contractCreatorAccount.address)
      ).toNumber()
    ).to.be.equal(
      collateralToMint - collateralDeposit,
      `contract ${minterContract.address} does not have expected balance of the difference of collateralDeposit and user previous balance.`
    )

    expect(
      BigNumber.from(
        await daiContract.balanceOf(minterContract.address)
      ).toNumber()
    ).to.be.equal(
      collateralDeposit,
      `contract ${minterContract.address} does not have expected balance of ${collateralDeposit}`
    )

    // Check msg.sender PHM balance
    expect(
      BigNumber.from(
        await phmContract.balanceOf(contractCreatorAccount.address)
      ).toNumber()
    ).to.be.equal(
      expectedPHM,
      `PHM Balance of ${contractCreatorAccount.address} is not equal to ${expectedPHM}`
    )

    // check collateral deposit is the same as collateralDeposit
    expect(
      BigNumber.from(
        await minterContract.getUserCollateralByCollateralAddress(
          daiContract.address
        )
      ).toNumber()
    ).to.be.equal(
      collateralDeposit,
      `collateral deposit is not equal to ${collateralDeposit}`
    )

    expect(
      await checkMintEvent(
        minterContract,
        contractCreatorAccount.address,
        expectedPHM
      )
    ).to.be.true

    expect(
      await checkDepositEvent(
        minterContract,
        contractCreatorAccount.address,
        daiContract.address,
        collateralDeposit
      )
    ).to.be.true
  })

  it('sending non collateral ERC20 to deposit func should not mint PHM, not return PHM to msg.sender and return error', async () => {
    // check that noncollateral contract is not whitelsited in the contract
    expect(await minterContract.isWhitelisted(nonCollateralAddress)).to.be.false

    try {
      await minterContract.depositByCollateralAddress(
        collateralDeposit,
        nonCollateralAddress
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert This is not allowed as collateral.'
      )
    }
  })

  it('sending invalid collateral amount to deposit func should not mint PHM, not return PHM to msg.sender and return error', async () => {
    try {
      await minterContract.depositByCollateralAddress(0, nonCollateralAddress)
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Invalid collateral amount.'
      )
    }
  })
})

describe('Can redeem synth for original ERC20 collateral', async () => {
  it('sending synth and calling redeem func should burn synth, return ERC20 collateral to msg.sender', async () => {
    expect(
      BigNumber.from(
        await phmContract.balanceOf(contractCreatorAccount.address)
      ).toNumber()
    ).to.equal(expectedPHM, `user current balance is not ${expectedPHM}`)

    const redeemTxn = await minterContract.redeemByCollateralAddress(
      collateralToRedeem,
      collateralAddress
    )

    await redeemTxn.wait()

    expect(
      BigNumber.from(
        await phmContract.balanceOf(contractCreatorAccount.address)
      ).toNumber()
    ).to.equal(
      expectedPHM - collateralToRedeem,
      `user current balance is not ${expectedPHM - collateralToRedeem}`
    )

    expect(
      BigNumber.from(
        await daiContract.balanceOf(minterContract.address)
      ).toNumber()
    ).to.equal(
      collateralDeposit - expectedConvertedCollateral,
      `user current balance is not ${
        collateralDeposit - expectedConvertedCollateral
      }`
    )

    expect(
      await checkWithdrawalEvent(
        minterContract,
        contractCreatorAccount.address,
        daiContract.address,
        expectedConvertedCollateral
      )
    ).to.be.true
  })
  it('sending invalid synth and calling redeem func should not burn synth, not return ERC20 collateral to msg.sender, and return err', async () => {
    // check that noncollateral contract is not whitelsited in the contract
    expect(await minterContract.isWhitelisted(nonCollateralAddress)).to.be.false

    try {
      await minterContract.redeemByCollateralAddress(
        collateralToRedeem,
        nonCollateralAddress
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert This is not allowed as collateral.'
      )
    }
  })

  it('sending invalid synth token amount and calling redeem func should not burn synth, not return ERC20 collateral to msg.sender, and return err', async () => {
    try {
      await minterContract.redeemByCollateralAddress(0, nonCollateralAddress)
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Invalid token amount.'
      )
    }
  })
})

describe('Can transfer synth to recipient wallet', () => {})
describe('Can earn HALO upon synth mint', () => {})
describe('Can earn HALO on transfer to whitelisted AMM address', () => {})

describe('Can call view functions from the contract', () => {
  it('Can get the balance of a collateral inside the contract', async () => {
    expect(
      BigNumber.from(
        await minterContract.getTotalCollateralByCollateralAddress(
          daiContract.address
        )
      ).toNumber()
    ).to.be.greaterThan(0)
  })
  it('Can get the user balance of the collateral inside the contract', async () => {
    expect(
      BigNumber.from(
        await minterContract.getUserCollateralByCollateralAddress(
          daiContract.address
        )
      ).toNumber()
    ).to.be.greaterThan(0)
  })
  it('Can get the current conversion rate for the given collateral', async () => {
    // Stub for price identifier
    expect(
      BigNumber.from(
        await minterContract.getConversionRate(daiContract.address)
      ).toNumber()
    ).to.be.equal(50, 'Conversion rate is not equal to 50')
  })
  it('Can whitelist a collateral address', async () => {
    await minterContract.addCollateralAddress(dumContract.address)
    expect(await minterContract.isWhitelisted(dumContract.address)).to.be.true
  })
  it('Can remove a collateral address to the whitelist', async () => {
    await minterContract.removeCollateralAddress(dumContract.address)
    expect(await minterContract.isWhitelisted(dumContract.address)).to.be.false
  })
  it('Can check if the given collateral address is in the whitelist', async () => {
    expect(await minterContract.isWhitelisted(daiContract.address)).to.be.true
  })
})
