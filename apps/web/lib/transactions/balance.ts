import {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
} from '@grana/money-logic'

// Pure aggregation lives in @grana/money-logic so it can be reused from
// apps/mobile. The Supabase-bound `getTransactionSums` read now lives in
// @grana/accounts (accounts is its only consumer); re-exported here so existing
// importers keep working.
export {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
}

export { getTransactionSums } from '@grana/accounts'
