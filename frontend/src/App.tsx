import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'
import React, { useEffect, useState } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Typography
} from '@material-ui/core'
import { getNetworkNameFromId } from './utils/Network'
import { NetworkNames } from './config/enums'
import Deposit from './components/Deposit'
import NotConnected from './components/NotConnected'
import contractAddressObject from './contracts/contract-address.json'
import PHMArtifact from './contracts/PHM.json'
import DAIArtifact from './contracts/DAI.json'
import PerpetualArtifact from './contracts/Perpetual.json'
import MinterArtifact from './contracts/Minter.json'
import { BigNumber, ethers } from 'ethers'
import { ExpandedIERC20, Minter, Perpetual } from './typechain'
import { bigNumberToFloat, formatBalance } from './utils/StringUtils'
import InvalidNetwork from './components/InvalidNetwork'
import AddressAndBalance from './components/AddressAndBalance'
import { Alert } from '@material-ui/lab'
import { useSnackbar } from 'notistack'
import { Balances } from './config/types'
import Redeem from './components/Redeem'

declare global {
  interface Window {
    ethereum: any | undefined
  }
}

const web3Modal = new Web3Modal({
  cacheProvider: true,
  providerOptions: {
    // metamask enabled by default so no need to specify here
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        rpc: {
          /**
           * The RPC URL mapping should be indexed by chainId and it requires at least one value
           * ChainId's: Mainnet (1), Ropsten (3), Rinkeby(4), Goerli (5) and Kovan (42)
           **/
          1: 'http://localhost:9545'
        }
      }
    }
  }
})

const App = () => {
  const [injectedProvider, setInjectedProvider] = useState<Web3Provider>()
  const [network, setNetwork] = useState(
    window.ethereum
      ? getNetworkNameFromId(window.ethereum.chainId)
      : NetworkNames.UNKNOWN
  )
  const [userAddress, setUserAddress] = useState<string>()
  const [balances, setBalances] = useState<Balances>({ ETH: 0, DAI: 0, PHM: 0 })
  const [conversionRate, setConversionRate] = useState(0)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [showNotConnectedModal, setShowNotConnectedModal] = useState(false)
  const [showInvalidNetworkModal, setShowInvalidNetworkModal] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [phmTotalSupply, setPhmTotalSupply] = useState(0)
  const [phmContract, setPhmContract] = useState<ExpandedIERC20>()
  const [daiContract, setDaiContract] = useState<ExpandedIERC20>()
  const [perpetualContract, setPerpetualContract] = useState<Perpetual>()
  const [minterContract, setMinterContract] = useState<Minter>()
  const { enqueueSnackbar } = useSnackbar()

  if (window.ethereum) {
    window.ethereum.on('chainChanged', (chainId: string) => {
      console.log('chainChanged -> ', chainId)
      if (!window.ethereum) return
      setNetwork(getNetworkNameFromId(window.ethereum.chainId))
    })
  }

  useEffect(() => {
    if (!injectedProvider) return

    console.log('Connected to network:', network)

    const getUserAddressAndBalance = async () => {
      const signer = injectedProvider.getSigner()
      const address = await signer.getAddress()
      console.log('user address:', address)
      setUserAddress(address)

      const bal = await injectedProvider.getBalance(address)
      console.log('ETH balance:', bal)
      setBalances({ ...balances, ETH: bigNumberToFloat(bal) })
    }

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

      const perpContract = new ethers.Contract(
        contractAddressObject.PerpetualContract,
        PerpetualArtifact.abi,
        injectedProvider.getSigner()
      ) as Perpetual

      setPerpetualContract(perpContract)
    }

    getUserAddressAndBalance().then(initContracts)
  }, [injectedProvider])

  useEffect(() => {
    refreshBalances()
  }, [phmContract, daiContract])

  useEffect(() => {
    if (!minterContract || !daiContract) return

    const getConversionRate = async () => {
      const rate = await minterContract.getConversionRate(daiContract.address)
      //console.log('Conversion rate:', rate.toNumber())
      setConversionRate(bigNumberToFloat(rate))
    }

    getConversionRate()
  }, [minterContract, daiContract])

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

  const disconnect = async () => {
    if (!injectedProvider) return

    await web3Modal.clearCachedProvider()

    setInjectedProvider(undefined)
    setUserAddress(undefined)
    setBalances({ ETH: 0, PHM: 0, DAI: 0 })
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

    // Subscribe to provider disconnection
    provider.on('disconnect', (error: { code: number; message: string }) => {
      console.log('provider.disconnected!', error)
      disconnect()
    })
  }

  const refreshBalances = async () => {
    let phmBalance = balances.PHM
    let daiBalance = balances.DAI

    if (phmContract) {
      try {
        const totalSupply = await phmContract.totalSupply()
        console.log('totalSupply:', totalSupply)
        setPhmTotalSupply(bigNumberToFloat(totalSupply))

        if (userAddress) {
          const bal = await phmContract.balanceOf(userAddress)
          console.log('PHM balance:', bal)
          phmBalance = bigNumberToFloat(bal)
        }
      } catch (err) {
        console.error(err)
      }
    }

    if (daiContract && userAddress) {
      const bal = await daiContract.balanceOf(userAddress)
      console.log('DAI balance:', bal)
      daiBalance = bigNumberToFloat(bal)
    }

    setBalances({ ...balances, PHM: phmBalance, DAI: daiBalance })
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
        perpetualContract={perpetualContract}
        onDepositSuccessful={() => {
          enqueueSnackbar('PHM successfully minted!', { variant: 'success' })
          refreshBalances()
          setShowDepositModal(false)
        }}
        onDepositRejected={() => {
          enqueueSnackbar('You have rejected the transaction!', {
            variant: 'error'
          })
        }}
      />

      <Redeem
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        phmBalance={balances['PHM']}
        conversionRate={conversionRate}
        minterContract={minterContract}
        phmContract={phmContract}
        onRedeemSuccessful={() => {
          enqueueSnackbar('DAI successfully redeemed!', { variant: 'success' })
          refreshBalances()
          setShowRedeemModal(false)
        }}
        onRedeemRejected={() => {
          enqueueSnackbar('You have rejected the transaction!', {
            variant: 'error'
          })
        }}
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
                {injectedProvider && network !== NetworkNames.LOCAL && (
                  <Box mt={1}>
                    <Alert severity="error">
                      To use our PHM minter, you need to be on the{' '}
                      {NetworkNames.LOCAL} network.
                    </Alert>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>

          <Box my={3}>
            <Paper>
              <Box p={2}>
                <Typography variant="caption">WALLET</Typography>
                <Box textAlign="center">
                  {userAddress ? (
                    <AddressAndBalance
                      address={userAddress}
                      balances={balances}
                      onDisconnect={disconnect}
                    />
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
                    {formatBalance(phmTotalSupply)}
                  </Typography>
                </Box>
                <Box mt={3} textAlign="center">
                  <Grid container>
                    <Grid item xs={12} md={6}>
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
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (injectedProvider) {
                            if (network === NetworkNames.LOCAL) {
                              setShowRedeemModal(true)
                            } else {
                              setShowInvalidNetworkModal(true)
                            }
                          } else {
                            setShowNotConnectedModal(true)
                          }
                        }}
                        disabled={isConnecting}
                      >
                        Redeem
                      </Button>
                    </Grid>
                  </Grid>

                  {userAddress && (
                    <Box mt={1}>
                      <Typography variant="caption">
                        1 DAI = {conversionRate?.toFixed(2)} PHM
                      </Typography>
                    </Box>
                  )}
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
