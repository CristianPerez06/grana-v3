import {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
  type DatedBalanceTransactionRow,
} from '@grana/money-logic'

// Pure aggregation lives in @grana/money-logic so it can be reused from
// apps/mobile. The Supabase-bound `getTransactionSums` read now lives in
// @grana/accounts (accounts is its only consumer); re-exported here so existing
// importers keep working.
export {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
  type DatedBalanceTransactionRow,
}

export { getTransactionSums } from '@grana/accounts'
