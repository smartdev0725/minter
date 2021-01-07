import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import React, { useEffect, useState } from 'react'
// import WalletConnectProvider from '@walletconnect/web3-provider'
import {
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Table,
  TableBody,
  Tooltip,
  Typography
} from '@material-ui/core'
import { getNetworkNameFromId } from './utils/Network'
import { Balances, Tokens } from './types/types'
import ETHIcon from './assets/eth.svg'
import DAIIcon from './assets/dai.svg'
import PHMIcon from './assets/phm.svg'
import { NetworkNames, Networks } from './types/enums'
import Deposit from './components/Deposit'
import NotConnected from './components/NotConnected'
import contractAddressObject from './contracts/contract-address.json'
import PHMArtifact from './contracts/PHM.json'
import DAIArtifact from './contracts/DAI.json'
import MinterArtifact from './contracts/Minter.json'
import { ethers } from 'ethers'
import { ExpandedIERC20, Minter } from './typechain'
import { bigNumberToFloat, shortenAddress } from './utils/StringUtils'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import InvalidNetwork from './components/InvalidNetwork'

declare global {
  interface Window {
    ethereum: any | undefined
  }
}

const web3Modal = new Web3Modal({
  cacheProvider: true,
  providerOptions: {
    // walletconnect: {
    //   package: WalletConnectProvider, // required
    //   options: {
    //     infuraId: 'fca9914262ce4cb08e533470cdd530ba'
    //   }
    // }
  }
})

const App = () => {
  const [injectedProvider, setInjectedProvider] = useState<Web3Provider>()
  const [network, setNetwork] = useState(
    window.ethereum
      ? getNetworkNameFromId(window.ethereum.chainId)
      : NetworkNames.UNKNOWN
  )
  const [address, setAddress] = useState<string>()
  const [balances, setBalances] = useState<Balances>({ ETH: 0, DAI: 0, PHM: 0 })
  const [conversionRate, setConversionRate] = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showNotConnectedModal, setShowNotConnectedModal] = useState(false)
  const [showInvalidNetworkModal, setShowInvalidNetworkModal] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [phmTotalSupply, setPhmTotalSupply] = useState(0)
  const [phmContract, setPhmContract] = useState<ExpandedIERC20>()
  const [daiContract, setDaiContract] = useState<ExpandedIERC20>()
  const [minterContract, setMinterContract] = useState<Minter>()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!injectedProvider) return

    const initContracts = () => {
      // Early return if connected to other network
      if (network !== NetworkNames.LOCAL) return

      setShowInvalidNetworkModal(false)

      // Get PHM contract from the chain
      const pContract = new ethers.Contract(
        contractAddressObject.PHM,
        PHMArtifact.abi,
        injectedProvider.getSigner()
      ) as ExpandedIERC20
      setPhmContract(pContract)

      // Get DAI contract from the chain
      const dContract = new ethers.Contract(
        contractAddressObject.DAI,
        DAIArtifact.abi,
        injectedProvider.getSigner()
      ) as ExpandedIERC20
      setDaiContract(dContract)

      // Get Minter contract from the chain
      const mContract = new ethers.Contract(
        contractAddressObject.Minter,
        MinterArtifact.abi,
        injectedProvider.getSigner()
      ) as Minter
      setMinterContract(mContract)
    }

    // Reload balance whenever web3 provider has *changed*:
    // - wallet has connected
    // - network has changed
    getETHBalance().then(initContracts)
  }, [injectedProvider])

  useEffect(() => {
    if (!phmContract) return

    // Get total PHM supply
    const getTotalSupply = async () => {
      const totalBig = await phmContract.totalSupply()
      console.log('totalSupply:', totalBig)
      setPhmTotalSupply(totalBig.toNumber())
    }

    // Get user's PHM balance
    const getPHMBalance = async () => {
      if (!address) return
      const bal = await phmContract.balanceOf(address)
      console.log('PHM balance:', bal)
      setBalances({ ...balances, PHM: bal.toNumber() })
    }

    // Hack: Make sure PHM balance is updated before DAI (or vice versa)
    // This is to prevent both from modifying the `balances` state at the
    // same time causing concurrency issue
    getPHMBalance().then(getTotalSupply)
  }, [phmContract])

  useEffect(() => {
    if (!daiContract) return

    const getDAIBalance = async () => {
      if (!address) return
      const bal = await daiContract.balanceOf(address)
      console.log('DAI balance:', bal)
      setBalances({ ...balances, DAI: bal.toNumber() })
    }

    getDAIBalance()
  }, [phmTotalSupply])

  useEffect(() => {
    if (!minterContract || !daiContract) return

    const getConversionRate = async () => {
      const rate = await minterContract.getConversionRate(daiContract.address)
      console.log('Conversion rate:', rate.toNumber())
      setConversionRate(rate.toNumber())
    }

    getConversionRate()
  }, [minterContract])

  /**
   * Watch window.ethereum to detect network changes
   */
  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId: string) => {
      if (!window.ethereum) return
      setNetwork(getNetworkNameFromId(window.ethereum.chainId))
    })
  }

  const connect = async () => {
    setIsConnecting(true)
    console.log('connecting...')
    try {
      const provider = await web3Modal.connect()
      console.log('provider:', provider)
      watch(provider)

      setInjectedProvider(new Web3Provider(provider))
      setIsConnecting(false)
      setShowNotConnectedModal(false)
    } catch (err) {
      console.error(err)
      setIsConnecting(false)
    }
  }

  const watch = (provider: any) => {
    // Subscribe to accounts change
    provider.on('accountsChanged', (accounts: string[]) => {
      console.log('provider.accountsChanged!', accounts)
    })

    // Subscribe to chainId change
    provider.on('chainChanged', (chainId: number) => {
      console.log('provider.chainChanged!', chainId)
      setInjectedProvider(new Web3Provider(provider))
    })

    // Subscribe to provider connection
    provider.on('connect', (info: { chainId: number }) => {
      console.log('provider.connected!', info)
    })

    // Subscribe to provider disconnection
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.log('provider.disconnected!', error)
      setInjectedProvider(undefined)
    })
  }

  const getETHBalance = async () => {
    if (!injectedProvider) return

    console.log('Connected to network:', network)

    // Get address first & store it in a state var
    const signer = injectedProvider.getSigner()
    const address = await signer.getAddress()
    setAddress(address)

    // Get balance once address is known
    const bal = await injectedProvider.getBalance(address)
    console.log('ETH balance:', bal)
    setBalances({ ...balances, ETH: bigNumberToFloat(bal) })

    // const bal = await daiContract.balanceOf(address)
    // console.log('DAI balance:', bal)
    // setBalances({ ...balances, DAI: bigNumberToFloat(bal) })
  }

  return (
    <div>
      <Deposit
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        daiBalance={balances['DAI']}
        conversionRate={conversionRate}
        minterContract={minterContract}
        collateralContract={daiContract}
      />

      <NotConnected
        isOpen={showNotConnectedModal}
        onClose={() => setShowNotConnectedModal(false)}
        onConnectClicked={connect}
        isConnecting={isConnecting}
      />

      <InvalidNetwork
        isOpen={showInvalidNetworkModal}
        onClose={() => setShowInvalidNetworkModal(false)}
      />

      <Container maxWidth="sm">
        <Box py={3}>
          <Typography variant="h4" style={{ color: 'white' }}>
            HaloDAO Minter Demo
          </Typography>

          <Box my={3}>
            <Paper>
              <Box p={2}>
                <Typography variant="caption">CURRENT NETWORK</Typography>
                <Typography>{network}</Typography>
              </Box>
            </Paper>
          </Box>

          <Box my={3}>
            <Paper>
              <Box p={2}>
                <Typography variant="caption">WALLET</Typography>
                <Box textAlign="center">
                  {address ? (
                    <div>
                      <Box mb={2}>
                        <Typography variant="caption">
                          Your public address
                        </Typography>
                        <Typography>
                          {shortenAddress(address)}
                          &nbsp;
                          <Tooltip title={copied ? 'Copied' : 'Copy'}>
                            <IconButton
                              onClick={() => {
                                navigator.clipboard.writeText(address)
                                setCopied(true)
                                setTimeout(() => {
                                  setCopied(false)
                                }, 2000)
                              }}
                            >
                              <FileCopyIcon color="primary" fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Typography>
                      </Box>
                      <Box px={12}>
                        <p>{JSON.stringify(balances)}</p>
                        <Table>
                          <TableBody>
                            {Object.values(Tokens).map((token) => {
                              return (
                                <tr key={token}>
                                  <td width={50}>
                                    <img
                                      src={
                                        token === Tokens.ETH
                                          ? ETHIcon
                                          : token === Tokens.DAI
                                          ? DAIIcon
                                          : PHMIcon
                                      }
                                      alt={token}
                                    />
                                  </td>
                                  <td width={50} align="left">
                                    <Typography>{token}</Typography>
                                  </td>
                                  <td align="right">
                                    <Typography>
                                      {balances[token].toFixed(2)}
                                    </Typography>
                                  </td>
                                </tr>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </div>
                  ) : (
                    <>
                      {isConnecting ? (
                        <>
                          <CircularProgress size="2rem" />
                          <Typography>Connecting...</Typography>
                        </>
                      ) : (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={connect}
                        >
                          Connect
                        </Button>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          </Box>

          <Box my={3}>
            <Paper>
              <Box p={2}>
                <Typography variant="caption">MINTER</Typography>
                <Box mt={2} textAlign="center">
                  <Typography variant="subtitle2">Total PHM supply</Typography>
                  <Typography variant="h2">
                    {phmTotalSupply.toFixed(2)}
                  </Typography>
                </Box>
                <Box mt={3} textAlign="center">
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      if (injectedProvider) {
                        if (network === NetworkNames.LOCAL) {
                          setShowDepositModal(true)
                        } else {
                          setShowInvalidNetworkModal(true)
                        }
                      } else {
                        setShowNotConnectedModal(true)
                      }
                    }}
                    disabled={isConnecting}
                  >
                    Deposit
                  </Button>
                  <Box mt={1}>
                    <Typography variant="caption">
                      1 DAI = {conversionRate.toFixed(2)} PHM
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>
    </div>
  )
}

export default App
