import Web3Modal from 'web3modal'
import { Web3Provider } from '@ethersproject/providers'
import { formatEther } from 'ethers/lib/utils'
import { useEffect, useState } from 'react'
import WalletConnectProvider from '@walletconnect/web3-provider'

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

  useEffect(() => {
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

    const signer = injectedProvider.getSigner()
    const address = await signer.getAddress()
    const bal = await injectedProvider.getBalance(address)

    const etherBalance = formatEther(bal)
    parseFloat(etherBalance).toFixed(2)
    const floatBalance = parseFloat(etherBalance)

    console.log('bal:', floatBalance.toFixed(4))
  }

  return (
    <div>
      <button onClick={connect}>Connect</button>
    </div>
  )
}

export default App
