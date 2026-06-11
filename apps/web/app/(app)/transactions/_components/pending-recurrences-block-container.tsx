'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { createClient } from '@/lib/supabase/client'
import { getPendingRecurrenceInstances } from '@/lib/recurrences/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'

/**
 * Client wrapper for `<PendingRecurrencesBlock>`. Fetches the pending
 * instances; if there is at least one, also reads accounts (already cached by
 * `MovementDrawerLoader` / `TransactionsHeader`, so this is a free lookup) to
 * derive the per-account/per-currency available balance used by the
 * negative-balance warning during confirmation.
 *
 * Mutations inside (confirm / skip an instance) invalidate the relevant query
 * keys via `invalidateAfterRecurrenceInstanceMutation` and the block updates
 * in place.
 */
export function PendingRecurrencesBlockContainer() {
  const [pendingQ, accountsQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.recurrencesPendingInstances,
        queryFn: () => getPendingRecurrenceInstances(createClient()),
      },
      // Accounts are needed only when there's a pending instance, but we leave
      // the query enabled unconditionally — `accountsList` has a 5min
      // staleTime and is already in cache from header/drawer-loader, so it
      // doesn't cost a fetch in practice.
      { queryKey: QUERY_KEYS.accountsList, queryFn: () => getAccounts(createClient()) },
    ],
  })

  const availableByAccount = useMemo(() => {
    if (!accountsQ.data) return undefined
    const map: Record<string, Record<'ARS' | 'USD', number>> = {}
    for (const account of [...accountsQ.data.cash, ...accountsQ.data.bank]) {
      map[account.id] = account.balances
    }
    return map
  }, [accountsQ.data])

  if (pendingQ.isPending || pendingQ.error || !pendingQ.data) return null

  return (
    <PendingRecurrencesBlock
      pending={pendingQ.data}
      availableByAccount={availableByAccount}
    />
  )
}
