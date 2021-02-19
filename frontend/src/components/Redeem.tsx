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

interface RedeemProps {
  isOpen: boolean
  onClose: () => void
  ubeBalance: number
  conversionRate: number
  minterContract?: Minter
  phmContract?: ExpandedIERC20
  onRedeemSuccessful: () => void
  onRedeemRejected: () => void
}

const Redeem = ({
  isOpen,
  onClose,
  ubeBalance,
  conversionRate,
  minterContract,
  phmContract,
  onRedeemSuccessful,
  onRedeemRejected
}: RedeemProps) => {
  const classes = useStyles()
  const [withdrawAmount, setWithdrawAmount] = useState(0)
  const [daiToBeRedeemed, setDaiToBeRedeemed] = useState(0)
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setDaiToBeRedeemed(withdrawAmount * conversionRate)

    if (withdrawAmount > 0 && withdrawAmount <= ubeBalance) {
      setCanWithdraw(true)
    } else {
      setCanWithdraw(false)
    }

    if (withdrawAmount > ubeBalance) {
      setInsufficientBalance(true)
    } else {
      setInsufficientBalance(false)
    }
  }, [withdrawAmount, conversionRate, ubeBalance])

  const redeem = async () => {
    if (!minterContract || !phmContract) return onClose()

    setIsProcessing(true)

    try {
      const amount = parseEther(`${withdrawAmount}`)

      await phmContract.approve(contractAddressObject.Minter, amount)
      console.log('Approved spend collateral tokens')

      const tx = await minterContract.redeemByCollateralAddress(
        (withdrawAmount * ContractHelper.DECIMALPADDING).toFixed(0),
        contractAddressObject.DAI
      )

      console.log('Redeemed collateral tokens')

      const res = await tx.wait()
      console.log('Tx result:', res)

      setIsProcessing(false)
      onRedeemSuccessful()
    } catch (err) {
      setIsProcessing(false)
      if (err.code && err.code === ChainError.REJECTED) {
        onRedeemRejected()
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
      <DialogTitle id="dialog-title">Redeem DAI</DialogTitle>
      <DialogContent>
        <DialogContentText>
          To redeem DAI, please specify amount of UBE to be withdrawn. We show a
          preview of how much DAI can be redeemed for your UBE.
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
                id="ube"
                label="UBE"
                type="number"
                fullWidth
                value={withdrawAmount}
                onChange={(e) => {
                  setWithdrawAmount(parseFloat(e.currentTarget.value))
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
                  Balance: {formatBalance(ubeBalance)} UBE
                </Typography>
              </Box>
              <TextField
                autoFocus
                margin="dense"
                id="dai"
                label="DAI"
                type="number"
                value={daiToBeRedeemed.toFixed(2)}
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
                onClick={redeem}
                disabled={!canWithdraw}
              >
                Redeem
              </Button>
            </>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default Redeem
