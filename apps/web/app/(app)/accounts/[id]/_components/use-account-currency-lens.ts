'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  runningBalanceCurrencies,
  type BalanceCurrency,
  type RunningBalanceRow,
} from '@grana/money-logic'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAccountMovementsAscending } from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'

export type AccountCurrencyLens = {
  /** Currencies the account uses (ARS first); null while loading. */
  currencies: BalanceCurrency[] | null
  /** The ledger being shown. `null` only while loading. */
  lens: BalanceCurrency | null
  /** Whether the ARS | USD pills show — only for an account that uses both. */
  show: boolean
  setLens: (currency: BalanceCurrency) => void
}

/**
 * The account detail's currency lens, read by the pills next to the
 * «Movimientos» title, the filters toolbar and the list. One ledger at a time:
 * ARS by default (the primary currency); the pills switch it. It IS the
 * `filters.currency` of the shared filters state, so every reader agrees.
 *
 * The queries are the same keys the list and the header already use, so
 * TanStack dedupes them: no extra fetch.
 */
export function useAccountCurrencyLens(accountId: string): AccountCurrencyLens {
  const { filters, dispatch } = useTransactionsFilters()

  const [ascendingQ, accountQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
        queryFn: () => getAccountMovementsAscending(createClient(), accountId),
      },
      {
        queryKey: QUERY_KEYS.accountDetail(accountId),
        queryFn: () => getAccountDetail(createClient(), accountId),
      },
    ],
  })

  const currencies = useMemo(() => {
    if (!ascendingQ.data || !accountQ.data) return null
    const account = accountQ.data
    const initialOf = (code: BalanceCurrency) =>
      Number(account.currencies.find((c) => c.currency_code === code)?.initial_balance ?? 0)
    return runningBalanceCurrencies(
      ascendingQ.data as RunningBalanceRow[],
      accountId,
      { ARS: initialOf('ARS'), USD: initialOf('USD') },
      account.currencies.map((c) => c.currency_code),
    )
  }, [ascendingQ.data, accountQ.data, accountId])

  return {
    currencies,
    lens: filters.currency ?? currencies?.[0] ?? null,
    show: (currencies?.length ?? 0) > 1,
    setLens: (currency) => dispatch({ type: 'setCurrency', currency }),
  }
}
