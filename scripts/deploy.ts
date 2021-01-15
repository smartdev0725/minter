import { artifacts, ethers } from 'hardhat'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import { TokenFactory } from '../typechain/TokenFactory'
import { Contract } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

const main = async () => {
  const [deployer, testUser] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)
  console.log('Account balance:', (await deployer.getBalance()).toString())

  // const wallet = await ethers.Wallet.fromMnemonic(process.env.MNEMONIC_SEED)
  console.log('Account 1 test user address:', testUser.address)

  // Deploy dummy DAI contract
  const daiFactory = await ethers.getContractFactory('ExpandedERC20')
  let daiContract = await daiFactory.deploy('DAI', 'DAI', '18')
  daiContract = await daiContract.deployed()
  await daiContract.addMinter(deployer.address)
  await daiContract.mint(testUser.address, parseEther('1000'))

  // Deploy PHM contract (by deploying TokenFactory & calling TokenFactory.createToken())
  const tokenFactory = await ethers.getContractFactory('TokenFactory')
  let tokenContract = await tokenFactory.deploy()
  tokenContract = await tokenContract.deployed()

  const tx = await tokenContract.createToken('Mochi PH Token', 'PHM', '18')
  const txReceiptEvent = (await tx.wait()).events.pop()
  const phmContract = (await ethers.getContractAt(
    'ExpandedERC20',
    txReceiptEvent.address,
    deployer
  )) as Contract

  // Deploy Minter contract
  const minterFactory = await ethers.getContractFactory('Minter')
  let minterContract = await minterFactory.deploy(phmContract.address)
  minterContract = await minterContract.deployed()

  // Initialize minter & add DAI collateral
  await minterContract.initialize()
  await minterContract.addCollateralAddress(daiContract.address)

  // Add minterContract as minter for DAI
  await daiContract.addMinter(minterContract.address)

  // Add minterContract as minter & burner for PHM
  await phmContract.addMinter(minterContract.address)
  await phmContract.addBurner(minterContract.address)

  // To be removed as well (moved to redeem function)
  // await minterContract.approveCollateralSpend(
  //   // to be removed as well
  //   daiContract.address,
  //   parseEther('10000')
  // )

  saveFrontendFiles(daiContract, phmContract, minterContract)
}

const saveFrontendFiles = (
  daiContract: Contract,
  phmContract: Contract,
  minterContract: Contract
) => {
  const contractsDir = __dirname + '/../frontend/src/contracts'
  const typechainSrcDir = __dirname + '/../typechain'
  const typechainDestDir = __dirname + '/../frontend/src/typechain'

  // Create target folders if doesn't exists
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir)
  }
  if (!fs.existsSync(typechainDestDir)) {
    fs.mkdirSync(typechainDestDir)
  }

  // Copy contract addresses to /frontend/src/contracts/contract-address.json directory
  fs.writeFileSync(
    contractsDir + '/contract-address.json',
    JSON.stringify(
      {
        DAI: daiContract.address,
        PHM: phmContract.address,
        Minter: minterContract.address
      },
      null,
      2
    )
  )

  // Copy contract abi's to /frontend/src/contracts/* directory
  const ERC20Artifact = artifacts.readArtifactSync('ExpandedERC20')
  fs.writeFileSync(
    contractsDir + '/DAI.json',
    JSON.stringify(ERC20Artifact, null, 2)
  )

  const IERC20Artifact = artifacts.readArtifactSync('ExpandedIERC20')
  fs.writeFileSync(
    contractsDir + '/PHM.json',
    JSON.stringify(IERC20Artifact, null, 2)
  )

  const MinterArtifact = artifacts.readArtifactSync('Minter')
  fs.writeFileSync(
    contractsDir + '/Minter.json',
    JSON.stringify(MinterArtifact, null, 2)
  )

  // Copy typechain to /frontend/src/typechain directory
  fse.copySync(typechainSrcDir, typechainDestDir)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
