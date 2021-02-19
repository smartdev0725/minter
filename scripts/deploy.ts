import { artifacts, ethers } from 'hardhat'
import * as fs from 'fs'
import * as fse from 'fs-extra'
import { Contract } from 'ethers'
import { formatEther } from 'ethers/lib/utils'

const main = async () => {
  const [deployer, testUser] = await ethers.getSigners()

  console.log('Account 0 Deployer Address:', deployer.address)
  console.log(
    'Account 0 Deployer balance:',
    formatEther(await deployer.getBalance())
  )

  console.log('Account 1 user address:', testUser.address)

  // CONTRACT ADDRESSES
  const financialContractAddress = process.env.FINANCIAL_CONTRACT_ADDRESS
  const collateralAddressUMA = process.env.DAI_CONTRACT_ADDRESS
  const ubeAddressUma = process.env.UBE_CONTRACT_ADDRESS
  console.log('financialContractAddress: ', financialContractAddress)
  console.log('collateralAddressUMA: ', collateralAddressUMA)
  console.log('ubeAddressUma: ', ubeAddressUma)

  // Deploy Minter contract
  const minterFactory = await ethers.getContractFactory('Minter')
  //   const collateralToken = await ethers.getContractAt(
  //     'DAI',
  //     collateralAddressUMA,
  //     deployer
  //   )

  let minterContract = await minterFactory.deploy(
    ubeAddressUma,
    financialContractAddress
  )
  minterContract = await minterContract.deployed()
  console.log('minterContract created at address: ', minterContract.address)

  // Initialize minter & add DAI collateral
  await minterContract.initialize()
  console.log('minterContract initialised')
  await minterContract.addCollateralAddress(collateralAddressUMA)
  console.log('DAI collateral added to minterContract')

  // Remove on kovan, added to compensate for conversion problems
  //await collateralToken.allocateTo(minterContract.address, parseEther('10000'))

  console.log(
    'Minter address successfully deployed, initialised and collateral whitelisted'
  )

  saveFrontendFiles(
    collateralAddressUMA,
    ubeAddressUma,
    financialContractAddress,
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
        UBE: phmContract,
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
