import { NetworkNames, Networks } from '../types/enums'

// export const browserIsWeb3Capable = () => {
//   // User Agent
//   const browser = Bowser.getParser(window.navigator.userAgent);
//   const userAgent = browser.parse().parsedResult;

//   const validBrowser = browser.satisfies({
//     desktop: {
//       chrome: '>49',
//       firefox: '>52',
//       opera: '>36',
//     },
//   })
//     ? true
//     : false;

//   const web3Capable = validBrowser || hasWeb3Available();

//   return web3Capable;
// }

// export const hasWeb3Available = () => {
//   const web3 = typeof window.web3 !== 'undefined'
//   const ethereum = typeof window.ethereum !== 'undefined'
//   const web3Available = web3 || ethereum

//   return web3Available
// }

export const getNetworkNameFromId = (network: Networks) => {
  switch (network) {
    case Networks.MAINNET:
      return NetworkNames.MAINNET
    case Networks.KOVAN:
      return NetworkNames.KOVAN
    case Networks.ROPSTEN:
      return NetworkNames.ROPSTEN
    case Networks.RINKEBY:
      return NetworkNames.RINKEBY
    case Networks.GOERLI:
      return NetworkNames.GOERLI
    case Networks.LOCAL:
      return NetworkNames.LOCAL
    default:
      return NetworkNames.UNKNOWN
  }
}
