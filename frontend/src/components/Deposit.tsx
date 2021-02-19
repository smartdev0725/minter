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
import { ExpandedIERC20, Minter, Perpetual } from '../typechain'
import contractAddressObject from '../contracts/contract-address.json'
import { ChainError, ContractHelper } from '../config/enums'
import { parseEther } from 'ethers/lib/utils'
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
  perpetualContract?: Perpetual
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
  perpetualContract,
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
    //setPhmToBeMinted(daiDeposit / conversionRate)

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
    if (!minterContract || !collateralContract || !perpetualContract)
      return onClose()

    setIsProcessing(true)

    try {
      const amount = parseEther(`${daiDeposit}`)

      // 0.1 -  approve transfer from msg.sender to minter
      await collateralContract.approve(contractAddressObject.Minter, amount)

      // 1- deposit collateral
      const tx = await minterContract.depositByCollateralAddress(
        (daiDeposit * ContractHelper.DECIMALPADDING).toFixed(0),
        (phmToBeMinted * ContractHelper.DECIMALPADDING).toFixed(0),
        contractAddressObject.DAI
      )

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
      <DialogTitle id="dialog-title">Mint UBE</DialogTitle>
      <DialogContent>
        <DialogContentText>
          To mint UBE, please deposit DAI as your collateral. We show a preview
          of how much UBE can be minted for your DAI deposit.
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
                id="ube"
                label="UBE"
                type="number"
                value={phmToBeMinted}
                onChange={(e) => {
                  setPhmToBeMinted(parseFloat(e.currentTarget.value))
                }}
                fullWidth
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
