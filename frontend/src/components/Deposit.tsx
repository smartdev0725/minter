import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Box,
  Grid,
  TextField,
  Typography,
  DialogActions,
  Button,
  makeStyles,
  CircularProgress
} from '@material-ui/core'
import SwapVertIcon from '@material-ui/icons/SwapVert'
import { ExpandedIERC20, Minter } from '../typechain'
import contractAddressObject from '../contracts/contract-address.json'
import { ChainError } from '../config/enums'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { formatBalance } from '../utils/StringUtils'

const useStyles = makeStyles({
  insufficientBalance: {
    '& input': {
      color: 'red'
    }
  },
  enoughBalance: {
    '& input': {
      color: 'inherit'
    }
  }
})

interface DepositProps {
  isOpen: boolean
  onClose: () => void
  daiBalance: number
  conversionRate: number
  minterContract?: Minter
  collateralContract?: ExpandedIERC20
  onDepositSuccessful: () => void
  onDepositRejected: () => void
}

const Deposit = ({
  isOpen,
  onClose,
  daiBalance,
  conversionRate,
  minterContract,
  collateralContract,
  onDepositSuccessful,
  onDepositRejected
}: DepositProps) => {
  const classes = useStyles()
  const [daiDeposit, setDaiDeposit] = useState(0)
  const [phmToBeMinted, setPhmToBeMinted] = useState(0)
  const [canDeposit, setCanDeposit] = useState(false)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setPhmToBeMinted(daiDeposit * conversionRate)

    if (daiDeposit > 0 && daiDeposit <= daiBalance) {
      setCanDeposit(true)
    } else {
      setCanDeposit(false)
    }

    if (daiDeposit > daiBalance) {
      setInsufficientBalance(true)
    } else {
      setInsufficientBalance(false)
    }
  }, [daiDeposit, conversionRate, daiBalance])

  const deposit = async () => {
    if (!minterContract || !collateralContract) return onClose()

    setIsProcessing(true)

    try {
      const amount = parseEther(`${daiDeposit}`)

      await collateralContract.approve(contractAddressObject.Minter, amount)
      console.log('Approved spend collateral tokens')

      const tx = await minterContract.depositByCollateralAddress(
        amount,
        contractAddressObject.DAI
      )
      console.log('Deposited collateral tokens')

      const res = await tx.wait()
      console.log('Tx result:', res)

      setIsProcessing(false)
      onDepositSuccessful()
    } catch (err) {
      setIsProcessing(false)
      if (err.code && err.code === ChainError.REJECTED) {
        onDepositRejected()
      }
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="dialog-title"
      maxWidth="xs"
    >
      <DialogTitle id="dialog-title">Mint PHM</DialogTitle>
      <DialogContent>
        <DialogContentText>
          To mint PHM, please deposit DAI as your collateral. We show a preview
          of how much PHM can be minted for your DAI deposit.
        </DialogContentText>
        <Box mx={6} textAlign="center">
          <Grid container spacing={2} justify="center" alignItems="center">
            <Grid item xs={3} sm={2}>
              <SwapVertIcon fontSize="large" />
            </Grid>
            <Grid item xs={9} sm={10}>
              <TextField
                autoFocus
                margin="dense"
                id="dai"
                label="DAI"
                type="number"
                fullWidth
                value={daiDeposit}
                onChange={(e) => {
                  setDaiDeposit(parseFloat(e.currentTarget.value))
                }}
                className={
                  insufficientBalance
                    ? classes.insufficientBalance
                    : classes.enoughBalance
                }
                disabled={isProcessing}
              />
              <Box textAlign="right">
                <Typography variant="caption">
                  Balance: {formatBalance(daiBalance)} DAI
                </Typography>
              </Box>
              <TextField
                autoFocus
                margin="dense"
                id="phm"
                label="PHM"
                type="number"
                value={phmToBeMinted.toFixed(2)}
                fullWidth
                disabled
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Box m={2} textAlign="center">
          {isProcessing ? (
            <Grid container spacing={1}>
              <Grid item>
                <CircularProgress size="1.2rem" />
              </Grid>
              <Grid item>
                <Typography>Processing...</Typography>
              </Grid>
            </Grid>
          ) : (
            <>
              <Button variant="contained" color="default" onClick={onClose}>
                Cancel
              </Button>
              &nbsp;&nbsp;&nbsp;
              <Button
                variant="contained"
                color="primary"
                onClick={deposit}
                disabled={!canDeposit}
              >
                Deposit
              </Button>
            </>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default Deposit
