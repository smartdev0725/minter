enum ConnectState {
  UNAVAILABLE = 'Metamask not installed',
  DISCONNECTED = 'Disconnected',
  CONNECTED = 'Connected',
  ADDRESS_NOT_CONTRACT = 'Could not connect to Token contract',
  WRONG_NETWORK = 'Wrong network: connect to localhost'
}

enum Networks {
  MAINNET = '0x1',
  KOVAN = '0x2a',
  ROPSTEN = '0x3',
  RINKEBY = '0x4',
  GOERLI = '0x5',
  LOCAL = '0x539'
}

enum NetworkNames {
  MAINNET = 'mainnet',
  KOVAN = 'kovan',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
  LOCAL = 'localhost:8545',
  UNKNOWN = 'unknown network'
}

export { ConnectState, Networks, NetworkNames }
