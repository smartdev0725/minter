export enum ConnectState {
  UNAVAILABLE = 'Metamask not installed',
  DISCONNECTED = 'Disconnected',
  CONNECTED = 'Connected',
  ADDRESS_NOT_CONTRACT = 'Could not connect to Token contract',
  WRONG_NETWORK = 'Wrong network: connect to localhost'
}

export enum Networks {
  MAINNET = '0x1',
  KOVAN = '0x2a',
  ROPSTEN = '0x3',
  RINKEBY = '0x4',
  GOERLI = '0x5',
  LOCAL = '0x539'
}

export enum NetworkNames {
  MAINNET = 'Mainnet',
  KOVAN = 'Kovan',
  ROPSTEN = 'Ropsten',
  RINKEBY = 'Rinkeby',
  GOERLI = 'Goerli',
  LOCAL = 'localhost:8545',
  UNKNOWN = 'Unknown Network'
}
