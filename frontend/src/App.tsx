import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'
import { formatEther } from 'ethers/lib/utils'
import React, { useEffect, useState } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import {
  Box,
  Button,
  Container,
  Paper,
  Table,
  TableHead,
  Typography
} from '@material-ui/core'
import { getNetworkNameFromId } from './utils/Network'
import { Balances } from './types/types'

declare global {
  interface Window {
    ethereum: any | undefined
  }
}

const web3Modal = new Web3Modal({
  cacheProvider: true,
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: 'fca9914262ce4cb08e533470cdd530ba'
      }
    }
  }
})

const App = () => {
  const [injectedProvider, setInjectedProvider] = useState<Web3Provider>()
  const [address, setAddress] = useState<string>()
  const [balances, setBalances] = useState<Balances>([
    { token: 'ETH', balance: 0 }
  ])

  useEffect(() => {
    if (!injectedProvider) return

    // Reload balance web3 provider has *changed*:
    // - wallet has connected
    // - network has changed
    getBalance()
  }, [injectedProvider])

  const connect = async () => {
    console.log('connecting...')
    const provider = await web3Modal.connect()
    watch(provider)

    setInjectedProvider(new Web3Provider(provider))

    // const web3 = new Web3(provider)

    // const balNumber = BigNumber.from(
    //   bal
    // ).toNumber()
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
    setBalances([...balances, { token: 'ETH', balance: floatBalance }])
  }

  return (
    <Container maxWidth="sm">
      <Box my={3}>
        <Typography variant="h4">HaloDAO Minter Demo</Typography>

        <Box my={3}>
          <Paper>
            <Box p={2}>
              <Typography variant="caption">CURRENT NETWORK</Typography>
              <Typography>
                {getNetworkNameFromId(window.ethereum.chainId)}
              </Typography>
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
                    <Typography>{address}</Typography>
                    <Table>
                      {balances.map((bal) => {
                        return (
                          <tr>
                            <td>{bal.token}</td>
                            <td>{bal.balance}</td>
                          </tr>
                        )
                      })}
                    </Table>
                  </div>
                ) : (
                  <Button variant="contained" color="primary" onClick={connect}>
                    Connect
                  </Button>
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
                <Button variant="contained" color="primary">
                  Deposit
                </Button>
                <Box mt={1}>
                  <Typography variant="caption">1 DAI = 48 PHM</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Container>
  )
}

export default App
