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
  // name not as impt, since does not have an artifact to reference since auto deployed by TokenFactory
  ubeContractLabelString: string = 'SyntheticToken',
  minterContractLabelString: string = 'Minter',
  empContractLabelString: string = 'ExpiringMultiParty'

// account that signs deploy txs
let contractCreatorAccount: SignerWithAddress

// Constants

// Contract variables that store deployed Contracts
let ubeContract: Contract,
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

// CONTRACT ADDRESSES
const empContractAddress = process.env.FINANCIAL_CONTRACT_ADDRESS
const collateralAddressUMA = process.env.DAI_CONTRACT_ADDRESS
const ubeAddressUma = process.env.UBE_CONTRACT_ADDRESS
console.log('financialContractAddress: ', empContractAddress)
console.log('collateralAddressUMA: ', collateralAddressUMA)
console.log('ubeAddressUma: ', ubeAddressUma)

const intialCollateral = parseEther('100000')

const expectedUserCollateralLeft = BigNumber.from(parseEther('1410'))
const expectedUserUBELeft = BigNumber.from(parseEther('470'))

// Value to be set after getting getGCR()
let expectedUBE, expectedConvertedCollateral

// single run per test setup
before(async () => {
  // define signers
  accounts = await ethers.getSigners()
  contractCreatorAccount = accounts[0]
  userAddress = accounts[1]
  otherUserAddress = accounts[2]
})

describe('should delpoy and get references of needed contracts from the blockchain', async () => {
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

  it('Get refto the EMP contract', async () => {
    const empContractReference = await ethers.getContractAt(
      empContractLabelString,
      empContractAddress
    )

    empContract = await empContractReference.deployed()

    expect(await isValidContract(empContract, empContractLabelString)).to.be
      .true
  })

  it('Get ref to the UBE contract', async () => {
    const ubeContractReference = await ethers.getContractAt(
      expandedERC20LabelString,
      ubeAddressUma
    )

    ubeContract = await ubeContractReference.deployed()

    expect(await isValidContract(ubeContract, ubeContractLabelString)).to.be
      .true
  })

  it('Can deploy and get ref to Minter Contract', async () => {
    const Minter = await ethers.getContractFactory(minterContractLabelString)

    const minterContractDeploy = await Minter.deploy(
      ubeAddressUma,
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

  it('sending collateral ERC20 to deposit func should mint UBE, return UBE to msg.sender', async () => {
    await daiContract.approve(minterContract.address, collateralDeposit)
    // deposit collateral to minter contract
    const depositTxn = await minterContract.depositByCollateralAddress(
      BigNumber.from(`${1500 * 100}`),
      BigNumber.from(`${500 * 100}`),
      collateralAddressUMA
    )

    await depositTxn.wait()

    expect(
      await checkDepositEvent(
        minterContract,
        contractCreatorAccount.address,
        collateralAddressUMA,
        collateralDeposit,
        BigNumber.from(parseEther('500'))
      )
    ).to.be.true
  })

  it('sending non collateral ERC20 to deposit func should not mint UBE, not return UBE to msg.sender and return error', async () => {
    // check that noncollateral contract is not whitelsited in the contract
    expect(await minterContract.isWhitelisted(nonCollateralAddress)).to.be.false

    try {
      await minterContract.depositByCollateralAddress(
        collateralDeposit,
        BigNumber.from(`${1500 * 100}`),
        nonCollateralAddress
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert This is not allowed as collateral.'
      )
    }
  })
  /*
  it('deposit func should not mint UBE when msg.sender do not  have enough collateral balance and return error', async () => {
    try {
      await minterContract.depositByCollateralAddress(
        parseEther('1230912309123091230192'),
        BigNumber.from(`${1500 * 100}`),
        collateralAddressUMA
      )
      assert(false, 'Error is not thrown')
    } catch (err) {
      expect(err.message).to.be.equal(
        'VM Exception while processing transaction: revert Not enough collateral amount'
      )
    }
  })
  */
})

describe('Can redeem synth for original ERC20 collateral', async () => {
  it('sending synth and calling redeem func should burn synth, return ERC20 collateral to msg.sender', async () => {
    await ubeContract.approve(minterContract.address, collateralToRedeem)

    const redeemTxn = await minterContract.redeemByCollateralAddress(
      collateralToRedeemNumber,
      collateralAddressUMA
    )

    await redeemTxn.wait()

    expect(
      await checkWithdrawalEvent(
        minterContract,
        contractCreatorAccount.address,
        daiContract.address,
        BigNumber.from(parseEther('90')),
        BigNumber.from(parseEther('30'))
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

describe('Can call view functions from the contract', () => {
  it('Get total collateral deposited to the financial contract of a collateral', async () => {
    expect(
      (
        await minterContract.getTotalCollateralByCollateralAddress(
          collateralAddressUMA
        )
      ).gte(expectedUserCollateralLeft)
    ).to.be.true
  })

  it('Get user total collateral deposited to the financial contract of a collateral', async () => {
    expect(
      await minterContract.getUserCollateralByCollateralAddress(
        collateralAddressUMA
      )
    ).to.equal(expectedUserCollateralLeft)
  })

  it('Get user total minted tokens', async () => {
    expect(
      await minterContract.getUserTotalMintedTokensByCollateralAddress(
        collateralAddressUMA
      )
    ).to.equal(expectedUserUBELeft)
  })

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

  it('Does not return userBalance and teturns an error if the collateral address is not whitelisted', async () => {
    try {
      await minterContract.getUserTotalMintedTokensByCollateralAddress(
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
    console.log('GCR: ', (await minterContract.getGCR()).toString())

    expect(
      BigNumber.from(await minterContract.getGCR()).gt(BigNumber.from(0)),
      'No position is created to compute GCR'
    ).to.be.true
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

  it('Can change the financial address as the contract adming', async () => {
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
