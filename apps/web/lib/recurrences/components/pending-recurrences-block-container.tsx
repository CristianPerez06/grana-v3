'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { reviewFeedState } from '@grana/recurrences'
import { RecurrenceFailureNotice } from './materialization-notice'
import { PendingRecurrencesBlock } from './pending-recurrences-block'
import { createClient } from '@/lib/supabase/client'
import { getPendingRecurrenceInstances } from '@/lib/recurrences/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { toFormAccounts } from '@/lib/accounts/form-accounts'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'

/**
 * Client wrapper for `<PendingRecurrencesBlock>`. It lives beside the block
 * rather than under Movimientos' `_components`: the dashboard mounts it too, and
 * a route-private folder is the wrong home for something two routes import.
 *
 * Fetches the pending
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
  const t = useTranslations('recurrences.materialization')
  const [pendingQ, accountsQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.recurrencesPendingInstances,
        queryFn: () => getPendingRecurrenceInstances(createClient()),
        // NO AUTO-RETRY: the read has a 15s deadline of its own
        // (`withReadTimeout`), and a retry on top of it is thirty seconds of a
        // page that looks exactly like having nothing to review. The retry is
        // the user's, on the button, once we have told them.
        retry: false,
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

  // A FAILED READ IS NOT AN EMPTY LIST. It used to be folded into "render
  // nothing", which tells the user they have nothing to review when the truth is
  // that nobody knows — the same defect as a swallowed materialization error, one
  // layer up. `reviewFeedState` is what keeps the two apart, and it is shared with
  // native so the two platforms cannot answer this differently.
  const feed = reviewFeedState(pendingQ)

  if (feed.kind === 'unreadable') {
    return (
      <RecurrenceFailureNotice
        title={t('read_failed_title')}
        body={t('read_failed_body')}
        onRetry={() => void pendingQ.refetch()}
        retrying={pendingQ.isFetching}
      />
    )
  }
  if (feed.kind !== 'list') return null

  return (
    <>
      {/* Rows are already on screen and a refresh failed. They stay: making
          vencimientos the user was looking at vanish over a transient failure is
          a worse answer than showing them slightly stale and saying so. */}
      {feed.refreshFailed && (
        <RecurrenceFailureNotice
          className="mb-3"
          title={t('refresh_failed_title')}
          body={t('refresh_failed_body')}
          onRetry={() => void pendingQ.refetch()}
          retrying={pendingQ.isFetching}
        />
      )}
      <PendingRecurrencesBlock
        pending={pendingQ.data ?? []}
        accounts={accounts}
        availableByAccount={availableByAccount}
      />
    </>
  )
}
