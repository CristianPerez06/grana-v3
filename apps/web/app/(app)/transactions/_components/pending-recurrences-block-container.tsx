'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { MaterializationNotice } from '@/lib/recurrences/components/materialization-notice'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { createClient } from '@/lib/supabase/client'
import { getPendingRecurrenceInstances } from '@/lib/recurrences/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { toFormAccounts } from '@/lib/accounts/form-accounts'
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

  // Same read, second consumer: the account picker the user gets when editing an
  // instance before confirming it ("this month I paid it with another card").
  const accounts = useMemo(
    () => (accountsQ.data ? toFormAccounts(accountsQ.data) : undefined),
    [accountsQ.data],
  )

  // The notice renders even with no pending instances: a materialization that
  // FAILED must not look like a user who has nothing to review, and a rebuild
  // that still owes occurrences has to offer to continue.
  if (pendingQ.isPending || pendingQ.error || !pendingQ.data) return <MaterializationNotice />

  return (
    <div className="flex flex-col gap-3">
      <MaterializationNotice />
      {pendingQ.data.length > 0 ? (
        <PendingRecurrencesBlock
          pending={pendingQ.data}
          accounts={accounts}
          availableByAccount={availableByAccount}
        />
      ) : null}
    </div>
  )
}
