import { useEffect, useState } from 'react'
import { ethers, utils } from 'ethers'
import TokenArtifact from './contracts/Token.json'
import contractAddress from './contracts/contract-address.json'
import { Token as TokenContract } from './typechain/Token'
import { ConnectState, Networks, NetworkNames } from './types/enums'
import { ContractInfo } from './types/types'

declare global {
  interface Window {
    ethereum: any | undefined
  }
}

function DApp() {
  const [connectState, setConnectState] = useState<ConnectState>(
    ConnectState.DISCONNECTED
  )
  const [contract, setContract] = useState<TokenContract | undefined>(undefined)
  const [contractInfo, setContractInfo] = useState<ContractInfo | undefined>(
    undefined
  )
  const [network, setNetwork] = useState<string>('')

  const checkNetworkCorrect = (network: Networks, chainIdHexString: string) => {
    if (chainIdHexString !== network) {
      setConnectState(ConnectState.WRONG_NETWORK)
      return false
    }
    return true
  }

  const getNetworkNameFromId = (network: Networks): NetworkNames => {
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

  const connect = async () => {
    // explicitly enables metamask
    await window.ethereum.enable()

    // 1 - initialize provider
    const provider = new ethers.providers.Web3Provider(window.ethereum)

    // 2 - Call the contract token
    const tokenContract = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      provider.getSigner()
    ) as TokenContract

    // 3 - Set contract data in state
    setContract(tokenContract)
  }

  const isContractDeployed = (contractByteCode: string) => {
    if (utils.hexDataLength(contractByteCode) === 0) {
      // address is not a contract if code size is 0
      setConnectState(ConnectState.ADDRESS_NOT_CONTRACT)
      return false
    }
  }

  window.ethereum.on('chainChanged', (chainId: string) => {
    setContractInfo(undefined)
    connect()
    console.log('chainId changed', chainId)
    checkNetworkCorrect(Networks.LOCAL, chainId)
  })

  useEffect(() => {
    // Check once if Metamask is installed
    if (window.ethereum === undefined) {
      setConnectState(ConnectState.UNAVAILABLE)
    } else checkNetworkCorrect(Networks.LOCAL, window.ethereum.chainId)
  }, [])

  useEffect(() => {
    // 1 - check if there is existing contract
    if (!contract) return

    // 2 - get contract info using the contract stored in state
    const getContractInfo = async () => {
      // define provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      // get current network
      const network = await provider.getNetwork()

      // check if contractAddress is a deployed contract
      const contractByteCode = await provider.getCode(contractAddress.Token)
      isContractDeployed(contractByteCode)

      // get needed information
      const name = await contract.name()
      const totalSupply = (await contract.totalSupply()).toNumber()
      // console.log(
      //   'Balance: ',
      //   await contract.balanceOf('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 ')
      // )

      setContractInfo({
        name,
        totalSupply
      })

      setNetwork(network.name)

      return true
    }

    // 4 - Call function
    getContractInfo()
      .then((isContractDeployed) => {
        // All good, mark as connected
        if (isContractDeployed) {
          setConnectState(ConnectState.CONNECTED)
        }
      })
      .catch((err) => {
        console.error(err)
        // Problem with connection
        setConnectState(ConnectState.WRONG_NETWORK)
      })
  }, [contract])

  return (
    <div
      className="DApp"
      style={{
        textAlign: 'center',
        marginTop: 100,
        maxWidth: 400,
        marginLeft: 'auto',
        marginRight: 'auto',
        fontSize: '1.2rem'
      }}
    >
      <h3>Status: {connectState}</h3>

      {connectState === ConnectState.DISCONNECTED && (
        <p>
          <button onClick={connect}>Connect with Metamask</button>
        </p>
      )}

      {connectState === ConnectState.UNAVAILABLE && (
        <p>
          Please install{' '}
          <a href="https://metamask.io/download.html">Metamask</a> first!
        </p>
      )}

      {(connectState === ConnectState.ADDRESS_NOT_CONTRACT ||
        connectState === ConnectState.WRONG_NETWORK) && (
        <p>
          Cannot detect contract. <br></br>
          <br></br>
          1) Check if contract is deployed<br></br>
          <br></br>
          2) Make sure Metamask is pointed to{' '}
          {getNetworkNameFromId(Networks.LOCAL)}
          <br></br>
          Current network: {getNetworkNameFromId(window.ethereum.chainId)}{' '}
        </p>
      )}

      {contractInfo && connectState === ConnectState.CONNECTED && (
        <div style={{ marginTop: 40 }}>
          <h1>PHPM Minter</h1>

          <input type="text" placeholder="PHPM Tokens To Mint" />
          <br />
          <input type="text" placeholder="Collateral (DAI)" />
          <br />
          <button onClick={() => {}}>Mint Tokens</button>
        </div>
      )}
    </div>
  )
}

export default DApp
