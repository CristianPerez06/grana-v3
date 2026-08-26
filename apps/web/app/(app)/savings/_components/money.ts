import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { BalanceCurrency } from '@grana/money-logic'

export const money = (amount: number, currency: BalanceCurrency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)
