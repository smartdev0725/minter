import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Typography
} from '@material-ui/core'
import { NetworkNames } from '../config/enums'

interface InvalidNetworkProps {
  targetNetwork: NetworkNames
  isOpen: boolean
  onClose: () => void
}

const InvalidNetwork = ({
  targetNetwork,
  isOpen,
  onClose
}: InvalidNetworkProps) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="dialog-title"
      maxWidth="xs"
    >
      <DialogTitle id="dialog-title">Wrong Network</DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Typography>
            To proceed, please switch your wallet's network to {targetNetwork}
          </Typography>
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}

export default InvalidNetwork
