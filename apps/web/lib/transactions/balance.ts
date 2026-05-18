import { createClient } from '@/lib/supabase/server'

// Returns a map of accountId → { ARS: net, USD: net }
// net = SUM(income amounts) - SUM(expense amounts) per (account, currency).
export async function getTransactionSums(
  accountIds: string[],
): Promise<Map<string, Record<'ARS' | 'USD', number>>> {
  const result = new Map<string, Record<'ARS' | 'USD', number>>()

  if (accountIds.length === 0) return result

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, currency_code, amount, type')
    .in('account_id', accountIds)

  if (error) throw error

  for (const row of data ?? []) {
    const accountId = row.account_id
    const currency = row.currency_code as 'ARS' | 'USD'

    if (currency !== 'ARS' && currency !== 'USD') continue

    if (!result.has(accountId)) {
      result.set(accountId, { ARS: 0, USD: 0 })
    }

    const sums = result.get(accountId)!
    const delta = row.type === 'income' ? Number(row.amount) : -Number(row.amount)
    sums[currency] += delta
  }

  return result
}
