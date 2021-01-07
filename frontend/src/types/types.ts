export type ContractInfo = {
  name: string
  totalSupply: number
}

export enum Tokens {
  ETH = 'ETH',
  DAI = 'DAI',
  PHM = 'PHM'
}

export type Balances = {
  [key in Tokens]: number
}
