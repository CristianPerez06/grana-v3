import { createClient } from '@/lib/supabase/server'

// Returns a map of accountId → { ARS: net, USD: net }
// net = Σ income − Σ expense − Σ transfer_out + Σ transfer_in + Σ adjustment(signed)
export async function getTransactionSums(
  accountIds: string[],
): Promise<Map<string, Record<'ARS' | 'USD', number>>> {
  const result = new Map<string, Record<'ARS' | 'USD', number>>()

  if (accountIds.length === 0) return result

  const supabase = await createClient()

  // Exclude credit card child transactions (status IS NOT NULL) and
  // off-ledger parent rows (is_parent=true, account_id=NULL, auto-excluded by the or filter)
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id, currency_code, amount, type')
    .or(
      `account_id.in.(${accountIds.join(',')}),transfer_destination_account_id.in.(${accountIds.join(',')})`,
    )
    .is('status', null)

  if (error) throw error

  const ensure = (id: string) => {
    if (!result.has(id)) result.set(id, { ARS: 0, USD: 0 })
    return result.get(id)!
  }

  for (const row of data ?? []) {
    const currency = row.currency_code as 'ARS' | 'USD'
    if (currency !== 'ARS' && currency !== 'USD') continue

    const amount = Number(row.amount)

    if (!row.account_id) continue

    if (row.type === 'income') {
      ensure(row.account_id)[currency] += amount
    } else if (row.type === 'expense') {
      ensure(row.account_id)[currency] -= amount
    } else if (row.type === 'transfer') {
      if (accountIds.includes(row.account_id)) {
        ensure(row.account_id)[currency] -= amount
      }
      if (
        row.transfer_destination_account_id &&
        accountIds.includes(row.transfer_destination_account_id)
      ) {
        ensure(row.transfer_destination_account_id)[currency] += amount
      }
    } else if (row.type === 'adjustment') {
      ensure(row.account_id)[currency] += amount
    }
  }

  return result
}
