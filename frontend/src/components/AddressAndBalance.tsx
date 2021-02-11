import React from 'react'
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Table,
  TableBody
} from '@material-ui/core'
import { formatBalance, shortenAddress } from '../utils/StringUtils'
import DAIIcon from '../assets/dai.png'
import UBEIcon from '../assets/ube.png'
import DisconnectIcon from '@material-ui/icons/ExitToApp'
import { Tokens } from '../config/enums'
import { Balances } from '../config/types'

interface AddressAndBalanceProps {
  address: string
  balances: Balances
  onDisconnect: () => void
}

const AddressAndBalance = ({
  address,
  balances,
  onDisconnect
}: AddressAndBalanceProps) => {
  return (
    <div>
      <Box mb={2}>
        <Typography variant="caption">Your public address</Typography>
        <Typography>
          {shortenAddress(address)}
          &nbsp;
          <Tooltip title="Disconnect">
            <IconButton onClick={onDisconnect}>
              <DisconnectIcon color="error" fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
      </Box>
      <Box px={12}>
        <Table>
          <TableBody>
            {Object.values(Tokens).map((token) => {
              return (
                <tr key={token}>
                  <td width={50}>
                    <img
                      width={32}
                      src={token === Tokens.DAI ? DAIIcon : UBEIcon}
                      alt={token}
                    />
                  </td>
                  <td width={50} align="left">
                    <Typography>{token}</Typography>
                  </td>
                  <td align="right">
                    <Typography>{formatBalance(balances[token], 2)}</Typography>
                  </td>
                </tr>
              )
            })}
          </TableBody>
        </Table>
      </Box>
    </div>
  )
}

export default AddressAndBalance
