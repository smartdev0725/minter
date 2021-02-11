import { artifacts, ethers } from 'hardhat'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import { TokenFactory } from '../typechain/TokenFactory'
import { Contract, providers } from 'ethers'
import { formatEther, parseEther } from 'ethers/lib/utils'

const main = async () => {
  const [deployer, testUser] = await ethers.getSigners()

  console.log('Deploying contracts with the account:', deployer.address)
  console.log('Account balance:', formatEther(await deployer.getBalance()))

  // const wallet = await ethers.Wallet.fromMnemonic(process.env.MNEMONIC_SEED)
  console.log('Account 1 test user address:', testUser.address)

  //const perpetualContractAddress = '0x67e8B6C4C72Be2A56F858279919B7cBC4BfF3084'
  // KOVAN ADDRESSES
  // const empContractAddress = '0xA1dF1Eb9bEB2f91444E2880E2B204096057b281d'
  // const collateralAddressUMA = '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa'
  // const phmAddressUma = '0x0e47a28e4f16db3a2583ab4195a7ba49a3e9cfe6'

  // LOCAL ADDRESSES
  const empContractAddress = '0xe93194815959Fb5879daC1283b912AD78c3D13c3'
  const collateralAddressUMA = '0x25AF99b922857C37282f578F428CB7f34335B379'
  const phmAddressUma = '0x55aec27A24933F075c6b178fb0DDD5346104E6f1'

  // Deploy Minter contract
  const minterFactory = await ethers.getContractFactory('Minter')
  const collateralToken = await ethers.getContractAt(
    'TestnetERC20',
    collateralAddressUMA,
    deployer
  )
  /*
  const empContractInstance = await ethers.getContractAt(
    'ExpiringMultiParty',
    empContractAddress,
    deployer
  )
  */
  let minterContract = await minterFactory.deploy(
    phmAddressUma,
    empContractAddress
  )
  minterContract = await minterContract.deployed()
  console.log('minterContract created at address: ', minterContract.address)

  // Initialize minter & add DAI collateral
  await minterContract.initialize()
  await minterContract.addCollateralAddress(collateralAddressUMA)

  // Remove on kovan, added to compensate for conversion problems
  //await collateralToken.allocateTo(minterContract.address, parseEther('10000'))

  console.log('Minter address: ', minterContract.address)

  saveFrontendFiles(
    collateralAddressUMA,
    phmAddressUma,
    empContractAddress,
    minterContract
  )
}

const saveFrontendFiles = (
  daiContract: string,
  phmContract: string,
  perpetualContract: string,
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
        DAI: daiContract,
        PHM: phmContract,
        Minter: minterContract.address,
        PerpetualContract: perpetualContract
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
    contractsDir + '/UBE.json',
    JSON.stringify(IERC20Artifact, null, 2)
  )

  const MinterArtifact = artifacts.readArtifactSync('Minter')
  fs.writeFileSync(
    contractsDir + '/Minter.json',
    JSON.stringify(MinterArtifact, null, 2)
  )

  const PerpetualArtifact = artifacts.readArtifactSync('Perpetual')
  fs.writeFileSync(
    contractsDir + '/Perpetual.json',
    JSON.stringify(PerpetualArtifact, null, 2)
  )

  // Copy typechain to /frontend/src/typechain directory
  fse.copySync(typechainSrcDir, typechainDestDir)

  console.log('Deploy script finished successfully!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
