import { createClient } from '@/lib/supabase/server'
import { Money, type MoneyType } from '@grana/validation'

type BalanceCurrency = 'ARS' | 'USD'
type BalanceBuckets = Record<BalanceCurrency, MoneyType>

export type BalanceTransactionRow = {
  account_id: string | null
  transfer_destination_account_id: string | null
  currency_code: string
  amount: number | string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
}

function emptyBuckets(): BalanceBuckets {
  return {
    ARS: Money.from(0),
    USD: Money.from(0),
  }
}

function isBalanceCurrency(currency: string): currency is BalanceCurrency {
  return currency === 'ARS' || currency === 'USD'
}

export function calculateTransactionSums(
  rows: BalanceTransactionRow[],
  accountIds: string[],
): Map<string, Record<BalanceCurrency, number>> {
  const accountIdSet = new Set(accountIds)
  const result = new Map<string, BalanceBuckets>()

  const ensure = (id: string) => {
    if (!result.has(id)) result.set(id, emptyBuckets())
    return result.get(id)!
  }

  for (const row of rows) {
    if (!isBalanceCurrency(row.currency_code) || !row.account_id) continue

    const currency = row.currency_code
    const amount = Money.from(row.amount)

    if (row.type === 'income') {
      ensure(row.account_id)[currency] = Money.add(ensure(row.account_id)[currency], amount)
    } else if (row.type === 'expense') {
      ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
    } else if (row.type === 'transfer') {
      if (accountIdSet.has(row.account_id)) {
        ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
      }
      if (
        row.transfer_destination_account_id &&
        accountIdSet.has(row.transfer_destination_account_id)
      ) {
        ensure(row.transfer_destination_account_id)[currency] = Money.add(
          ensure(row.transfer_destination_account_id)[currency],
          amount,
        )
      }
    } else if (row.type === 'adjustment') {
      ensure(row.account_id)[currency] = Money.add(ensure(row.account_id)[currency], amount)
    }
  }

  return new Map(
    [...result.entries()].map(([accountId, balances]) => [
      accountId,
      {
        ARS: Money.toNumber(balances.ARS),
        USD: Money.toNumber(balances.USD),
      },
    ]),
  )
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
    .select('account_id, transfer_destination_account_id, currency_code, amount, type')
    .or(
      `account_id.in.(${accountIds.join(',')}),transfer_destination_account_id.in.(${accountIds.join(',')})`,
    )
    .is('status', null)

  if (error) throw error

  return calculateTransactionSums((data ?? []) as BalanceTransactionRow[], accountIds)
}
