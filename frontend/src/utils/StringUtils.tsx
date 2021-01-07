import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'

export const shortenAddress = (address: string) => {
  if (address.length < 10) return address

  let displayAddress = address.substr(0, 6)
  displayAddress += '...' + address.substr(-4)
  return displayAddress
}

export const bigNumberToFloat = (bNumber: BigNumber) => {
  const etherBalance = formatEther(bNumber)
  parseFloat(etherBalance).toFixed(2)
  return parseFloat(etherBalance)
}
