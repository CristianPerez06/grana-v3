import { createClient } from '@/lib/supabase/server'
import {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
} from '@grana/money-logic'

// Pure aggregation lives in @grana/money-logic so it can be reused from
// apps/mobile. This module keeps the Supabase-bound wrapper because each app
// builds its own Supabase client.
export {
  calculateTransactionSums,
  type BalanceCurrency,
  type BalanceTransactionRow,
}

// Returns a map of accountId -> { ARS: net, USD: net }
// net = income - expense - transfer_out + transfer_in + adjustment(signed)
export async function getTransactionSums(
  accountIds: string[],
): Promise<Map<string, Record<BalanceCurrency, number>>> {
  if (accountIds.length === 0) return new Map()

  const supabase = await createClient()

  // Exclude credit card child transactions (status IS NOT NULL) and
  // off-ledger parent rows (is_parent=true, account_id=NULL, auto-excluded by the or filter).
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id, currency_code, amount, type, destination_amount, destination_currency')
    .or(
      `account_id.in.(${accountIds.join(',')}),transfer_destination_account_id.in.(${accountIds.join(',')})`,
    )
    .is('status', null)

  if (error) throw error

  return calculateTransactionSums((data ?? []) as BalanceTransactionRow[], accountIds)
}
