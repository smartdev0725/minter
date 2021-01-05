import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'
import { formatEther } from 'ethers/lib/utils'
import React, { useEffect, useState } from 'react'
// import WalletConnectProvider from '@walletconnect/web3-provider'
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Table,
  Typography
} from '@material-ui/core'
import { getNetworkNameFromId } from './utils/Network'
import { Balances } from './types/types'
import ETHIcon from './assets/eth.svg'
import DAIIcon from './assets/dai.svg'
import PHMIcon from './assets/phm.svg'
import { NetworkNames } from './types/enums'
import Deposit from './components/Deposit'
import NotConnected from './components/NotConnected'

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
  const [conversionRate] = useState(48)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showNotConnectedModal, setShowNotConnectedModal] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (!injectedProvider) return

    // Reload balance whenever web3 provider has *changed*:
    // - wallet has connected
    // - network has changed
    getBalance()
  }, [injectedProvider])

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
      // getBalance()
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

  const getBalance = async () => {
    if (!injectedProvider) return

    // Get address first & store it in a state var
    const signer = injectedProvider.getSigner()
    const address = await signer.getAddress()
    setAddress(address)

    // Get balance once address is known
    const bal = await injectedProvider.getBalance(address)

    // Format balance to ETH
    const etherBalance = formatEther(bal)
    parseFloat(etherBalance).toFixed(2)
    const floatBalance = parseFloat(etherBalance)

    // Save ETH balance to state var
    setBalances({ ...balances, ETH: floatBalance })
  }

  return (
    <div>
      <Deposit
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        daiBalance={/*balances['DAI']*/ 100}
        conversionRate={conversionRate}
      />

      <NotConnected
        isOpen={showNotConnectedModal}
        onClose={() => setShowNotConnectedModal(false)}
        onConnectClicked={connect}
        isConnecting={isConnecting}
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
                        <Typography>{address}</Typography>
                      </Box>
                      <Box px={12}>
                        <Table>
                          {Object.keys(balances).map((token) => {
                            return (
                              <tr>
                                <td width={50}>
                                  <img
                                    src={
                                      token === 'ETH'
                                        ? ETHIcon
                                        : token === 'DAI'
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
                                    {balances[token] > 0
                                      ? balances[token]
                                      : balances[token].toFixed(2)}
                                  </Typography>
                                </td>
                              </tr>
                            )
                          })}
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
                  <Typography variant="h2">1000</Typography>
                </Box>
                <Box mt={3} textAlign="center">
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      if (injectedProvider) {
                        setShowDepositModal(true)
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
                      1 DAI = {conversionRate} PHM
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
