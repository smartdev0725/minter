type TokenDetails = {
  name: string
  symbol: string
  decimals: string
}

type DepositedCollateralEvent = {
  user: string
  collateral: number
  collateralAddress: string
}

type WithdrawnCollateralEvent = {
  user: string
  collateral: number
  collateralAddress: string
}

type MintEvent = {
  user: string
  value: number
}

type BurnEvent = {
  user: string
  value: number
}

type ChangedFinancialContractAddressEvent = {
  newFinancialContractAddress: string
}

export type {
  TokenDetails,
  DepositedCollateralEvent,
  WithdrawnCollateralEvent,
  MintEvent,
  BurnEvent,
  ChangedFinancialContractAddressEvent
}
