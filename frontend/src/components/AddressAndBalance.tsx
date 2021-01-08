import React, { useState } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Table,
  TableBody
} from '@material-ui/core'
import { formatBalance, shortenAddress } from '../utils/StringUtils'
import ETHIcon from '../assets/eth.svg'
import DAIIcon from '../assets/dai.svg'
import PHMIcon from '../assets/phm.svg'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import { Tokens } from '../config/enums'
import { Balances } from '../config/types'

interface AddressAndBalanceProps {
  address: string
  balances: Balances
}

const AddressAndBalance = ({ address, balances }: AddressAndBalanceProps) => {
  const [copied, setCopied] = useState(false)

  return (
    <div>
      <Box mb={2}>
        <Typography variant="caption">Your public address</Typography>
        <Typography>
          {shortenAddress(address)}
          &nbsp;
          <Tooltip title={copied ? 'Copied' : 'Copy'}>
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(address)
                setCopied(true)
                setTimeout(() => {
                  setCopied(false)
                }, 2000)
              }}
            >
              <FileCopyIcon color="primary" fontSize="small" />
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
                      src={
                        token === Tokens.ETH
                          ? ETHIcon
                          : token === Tokens.DAI
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
                      {formatBalance(
                        balances[token],
                        token === Tokens.ETH ? 6 : 2
                      )}
                    </Typography>
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
