import { Money, type MoneyType } from '@grana/validation'

export type BalanceCurrency = 'ARS' | 'USD'
type BalanceBuckets = Record<BalanceCurrency, MoneyType>

export type BalanceTransactionRow = {
  account_id: string | null
  transfer_destination_account_id: string | null
  currency_code: string
  amount: number | string
  type: 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'
  /** Destination leg of an exchange (currency conversion). Only set for type='exchange'. */
  destination_amount?: number | string | null
  destination_currency?: string | null
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

/**
 * Sum a flat list of transaction rows by account and currency.
 *
 * Pure function: the caller fetches the rows (typically excluding off-ledger
 * credit-card transactions via `.is('status', null)`) and passes the relevant
 * account ids. Returns a map of accountId -> { ARS, USD } in `number` form
 * (already collapsed from Money).
 */
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
    } else if (row.type === 'exchange') {
      // Currency conversion: subtract `amount` in `currency_code` from the source
      // account, add `destination_amount` in `destination_currency` to the dest
      // account (which may be the same account, a different currency bucket).
      if (accountIdSet.has(row.account_id)) {
        ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
      }
      if (
        row.transfer_destination_account_id &&
        accountIdSet.has(row.transfer_destination_account_id) &&
        row.destination_currency &&
        isBalanceCurrency(row.destination_currency) &&
        row.destination_amount != null
      ) {
        const destCurrency = row.destination_currency
        ensure(row.transfer_destination_account_id)[destCurrency] = Money.add(
          ensure(row.transfer_destination_account_id)[destCurrency],
          Money.from(row.destination_amount),
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
