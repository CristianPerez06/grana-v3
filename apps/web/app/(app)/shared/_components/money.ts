import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { BalanceCurrency } from '@grana/money-logic'

export const fmtMoney = (amount: number, currency: BalanceCurrency): string =>
  currency === 'ARS' ? formatARS(amount) : formatUSD(amount)
