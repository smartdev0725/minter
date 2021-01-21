import { Tokens } from './enums'

export type Balances = {
  [key in Tokens]: number
}
