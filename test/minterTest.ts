import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract } from 'ethers'
import { deployContract, isValidContract } from './util/DeployContract'
import {
  checkChangedFinancialContractAddressEvent,
  checkDepositEvent,
  checkWithdrawalEvent
} from './util/CheckEvent'
import { doesNotMatch } from 'assert'
import {
  base64,
  formatEther,
  hexlify,
  parseBytes32String,
  parseEther
} from 'ethers/lib/utils'

import { decodeTx } from 'ethereum-tx-decoder'

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
  minterContractLabelString: string = 'Minter',
  empContractLabelString: string = 'ExpiringMultiParty'

// account that signs deploy txs
let contractCreatorAccount: SignerWithAddress

// Constants
// const priceFeedIdentifier = utf8ToHex('ETH/USD') // need this for UMA minting

// Contract variables that store deployed Contracts
let tokenFactoryContract: Contract,
  phmContract: Contract,
  minterContract: Contract,
  daiContract: Contract,
  dumContract: Contract,
  empContract: Contract

// Fake DAI Collaeral details
const nonCollateralTokenDetails = {
  name: 'DUM Dummy Token',
  symbol: 'DUM',
  decimals: '18'
}

// constants
/**
 * --RawValue: number in ether format
 * --Number: Padded decimal format
 * --no suffix: wei format
 */

const collateralRawValue = 1500
const collateralToRedeemRawValue = 30
const collateralDeposit = BigNumber.from(parseEther(`${collateralRawValue}`)) // total collateral to be deposited
const collateralToRedeem = BigNumber.from(
  parseEther(`${collateralToRedeemRawValue}`)
)
const collateralDepositNumber = BigNumber.from(`${collateralRawValue * 100}`) // padded with 2 extra zeroes
const collateralToRedeemNumber = BigNumber.from(
  `${collateralToRedeemRawValue * 100}`
) // padded with 2 extra zeroes
const empContractAddress = '0xe93194815959Fb5879daC1283b912AD78c3D13c3'
const collateralAddressUMA = '0x25AF99b922857C37282f578F428CB7f34335B379'
const phmAddressUma = '0x55aec27A24933F075c6b178fb0DDD5346104E6f1'
const intialCollateral = parseEther('100000')

let expectedPHM, expectedConvertedCollateral

// single run per test setup
before(async () => {
  // define signers
  accounts = await ethers.getSigners()
  contractCreatorAccount = accounts[0]
  userAddress = accounts[1]
  otherUserAddress = accounts[2]
})

describe('should set up and connect to the ganache node properly', async () => {
  // create the collateral token (this should be the existing DAI contract not created by us)
  it('Can deploy and get ref to DAI Contract', async () => {
    // deploy Contract with 'expect' assurances
    const daiContractReference = await ethers.getContractAt(
      'TestnetERC20',
      collateralAddressUMA
    )

    daiContract = await daiContractReference.deployed()

    expect(await isValidContract(daiContract, 'TestnetERC20')).to.be.true

    await daiContract.allocateTo(
      contractCreatorAccount.address,
      intialCollateral
    )
    // get balance
    const daiBalance = BigNumber.from(
      await daiContract.balanceOf(contractCreatorAccount.address)
    )

    // test if values are equal
    expect(
      daiBalance.gte(intialCollateral),
      'Collateral to mint is not equal to dai balance'
    ).to.be.true
  })

  it('Get reference to the EMP contract', async () => {
    const empContractReference = await ethers.getContractAt(
      empContractLabelString,
      empContractAddress
    )

    empContract = await empContractReference.deployed()

    expect(await isValidContract(empContract, empContractLabelString)).to.be
      .true
  })

  it('Get reference to the PHM contract', async () => {
    const phmContractReference = await ethers.getContractAt(
      expandedERC20LabelString,
      phmAddressUma
    )

    phmContract = await phmContractReference.deployed()

    expect(await isValidContract(phmContract, empContractLabelString)).to.be
      .true
  })

  it('Can deploy and get ref to Minter Contract', async () => {
    const Minter = await ethers.getContractFactory(minterContractLabelString)

    const minterContractDeploy = await Minter.deploy(
      phmAddressUma,
      empContractAddress
    )

    minterContract = await minterContractDeploy.deployed()

    expect(await isValidContract(minterContract, minterContractLabelString)).to
      .be.true

    await minterContract.initialize()
  })

  it('Can whitelist collateral address to minter contract', async () => {
    // whitelist DAI collateral address
    await minterContract.addCollateralAddress(collateralAddressUMA)
    expect(await minterContract.isWhitelisted(collateralAddressUMA)).to.be.true
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
    await dumContract.mint(contractCreatorAccount.address, intialCollateral)

    // get balance
    const dumBalance = BigNumber.from(
      await daiContract.balanceOf(contractCreatorAccount.address)
    )

    // test if values are equal
    expect(dumBalance.gte(intialCollateral)).to.be.true
  })
})

describe('Can accept collateral and mint synthetic', async () => {
  beforeEach(async () => {})

  it('sending collateral ERC20 to deposit func should mint PHM, return PHM to msg.sender', async () => {
    expectedPHM = parseEther(
      `${
        collateralRawValue /
        (await minterContract.getConversionRate()).toNumber()
      }`
    )

    await daiContract.approve(minterContract.address, collateralDeposit)
    // deposit collateral to minter contract
    const depositTxn = await minterContract.depositByCollateralAddress(
      collateralDepositNumber,
      collateralAddressUMA
    )

    await depositTxn.wait()

    console.log(
      'Deposit  - PHM: ',
      formatEther(
        await phmContract.balanceOf(contractCreatorAccount.address)
      ).toString()
    )

    console.log(
      'Deposit - Collateral Balance ',
      formatEther(
        await daiContract.balanceOf(contractCreatorAccount.address)
      ).toString()
    )

    expect(
      await checkDepositEvent(
        minterContract,
        contractCreatorAccount.address,
        collateralAddressUMA,
        collateralDeposit,
        expectedPHM
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

  it('deposit func should not mint PHM when msg.sender do not  have enough collateral balance and return error', async () => {
    try {
      await minterContract.depositByCollateralAddress(
        parseEther('1230912309123091230192'),
        collateralAddressUMA
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Not enough collateral amount'
      )
    }
  })
})

// it('sending invalid collateral amount to deposit func should not mint PHM, not return PHM to msg.sender and return error', async () => {
//   try {
//     await minterContract.depositByCollateralAddress(0, nonCollateralAddress)
//     assert(false, 'Error is not thrown')
//   } catch (err) {
//     expect(err.message).to.be.equal(
//       'VM Exception while processing transaction: revert Invalid collateral amount.'
//     )
//   }
// })

describe('Can redeem synth for original ERC20 collateral', async () => {
  it('sending synth and calling redeem func should burn synth, return ERC20 collateral to msg.sender', async () => {
    expectedConvertedCollateral = parseEther(
      `${
        collateralToRedeemRawValue *
        (await minterContract.getConversionRate()).toNumber()
      }`
    )
    await phmContract.approve(minterContract.address, collateralToRedeem)

    const redeemTxn = await minterContract.redeemByCollateralAddress(
      collateralToRedeemNumber,
      collateralAddressUMA
    )

    await redeemTxn.wait()

    console.log(
      'Redeem - PHM: ',
      formatEther(
        await phmContract.balanceOf(contractCreatorAccount.address)
      ).toString()
    )

    console.log(
      'Redeem - Collateral Balance ',
      formatEther(
        await daiContract.balanceOf(contractCreatorAccount.address)
      ).toString()
    )

    expect(
      await checkWithdrawalEvent(
        minterContract,
        contractCreatorAccount.address,
        daiContract.address,
        expectedConvertedCollateral,
        collateralToRedeem
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
})

describe('Can transfer synth to recipient wallet', () => {})
describe('Can earn HALO upon synth mint', () => {})
describe('Can earn HALO on transfer to whitelisted AMM address', () => {})

describe('Can call view functions from the contract', () => {
  it('Does not return the balance of the collateral and returns an error if not whitelisted', async () => {
    try {
      await minterContract.getTotalCollateralByCollateralAddress(
        dumContract.address
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Collateral address is not whitelisted.'
      )
    }
  })

  it('Does not return userBalance and teturns an error if the collateral address is not whitelisted', async () => {
    try {
      await minterContract.getUserCollateralByCollateralAddress(
        dumContract.address
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Collateral address is not whitelisted.'
      )
    }
  })

  it('Can get the current conversion rate for the given collateral', async () => {
    // Assuming there is a position created already
    expect(
      (await minterContract.getConversionRate()).toNumber()
    ).to.be.greaterThan(
      0,
      'No position is created to calculate conversion rate'
    )
  })

  it('Can get the current conversion rate for the given collateral', async () => {
    expect((await minterContract.getGCR()).toNumber()).to.be.greaterThan(
      0,
      'No position is created to compute GCR'
    )
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
    expect(await minterContract.isWhitelisted(collateralAddressUMA)).to.be.true
  })

  it('Can check the current financial contract address', async () => {
    expect(await minterContract.getFinancialContractAddress()).to.be.equal(
      empContractAddress
    )
  })

  it('Can change the financial address if owner', async () => {
    const dummyEmp = '0xc3E4EDA3c2Da722e7b143773EEd77249584B1782'
    const changeFinancialTx = await minterContract.setFinancialContractAddress(
      dummyEmp
    )

    await changeFinancialTx.wait()
    expect(await minterContract.getFinancialContractAddress()).to.be.equal(
      dummyEmp
    )

    checkChangedFinancialContractAddressEvent(minterContract, dummyEmp)
  })
})
