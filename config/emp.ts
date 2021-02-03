// TODO: Deploy the Timer.address
const constructorParams = {
  expirationTimestamp: '1706780800',
  collateralAddress: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa ',
  priceFeedIdentifier: web3.utils.padRight(web3.utils.fromAscii('DAIPHP')),
  syntheticName: 'Philipine Peso',
  syntheticSymbol: 'PHM',
  collateralRequirement: { rawValue: web3.utils.toWei('1.2') },
  disputeBondPercentage: { rawValue: web3.utils.toWei('0.1') },
  sponsorDisputeRewardPercentage: { rawValue: web3.utils.toWei('0.1') },
  disputerDisputeRewardPercentage: { rawValue: web3.utils.toWei('0.1') },
  minSponsorTokens: { rawValue: '100000000000000' },
  timerAddress: Timer.address,
  withdrawalLiveness: 7200,
  liquidationLiveness: 7200,
  excessTokenBeneficiary: '0x0000000000000000000000000000000000000000',
  financialProductLibraryAddress: '0x0000000000000000000000000000000000000000'
}

const constructorParams = {
  expirationTimestamp: '1706780800',
  collateralAddress: TestnetERC20.address,
  priceFeedIdentifier: web3.utils.padRight(web3.utils.fromAscii('UMATEST')),
  syntheticName: 'Test UMA Token',
  syntheticSymbol: 'UMATEST',
  collateralRequirement: { rawValue: web3.utils.toWei('1.5') },
  disputeBondPercentage: { rawValue: web3.utils.toWei('0.1') },
  sponsorDisputeRewardPercentage: { rawValue: web3.utils.toWei('0.1') },
  disputerDisputeRewardPercentage: { rawValue: web3.utils.toWei('0.1') },
  minSponsorTokens: { rawValue: '100000000000000' },
  timerAddress: Timer.address,
  withdrawalLiveness: 7200,
  liquidationLiveness: 7200,
  excessTokenBeneficiary: '0x0000000000000000000000000000000000000000',
  financialProductLibraryAddress: '0x0000000000000000000000000000000000000000'
}
