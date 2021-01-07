import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Typography
} from '@material-ui/core'
import { NetworkNames } from '../types/enums'

interface InvalidNetworkProps {
  isOpen: boolean
  onClose: () => void
}

const InvalidNetwork = ({ isOpen, onClose }: InvalidNetworkProps) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="dialog-title"
      maxWidth="sm"
    >
      <DialogTitle id="dialog-title">Wrong Network</DialogTitle>
      <DialogContent>
        <DialogContentText>
          <Typography>
            To proceed, please switch your wallet's network to{' '}
            {NetworkNames.LOCAL}
          </Typography>
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}

export default InvalidNetwork
