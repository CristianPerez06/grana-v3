'use client'

import { useQuery } from '@tanstack/react-query'
import { PendingReimbursementsBlock } from '@/lib/transactions/components/pending-reimbursements-block'
import { getPendingReimbursements } from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { formatDateISO, getTodayAR } from '@/lib/date'

type Props = {
  accountId: string
}

/**
 * Account-scoped variant of the pending reimbursements container. Same as the
 * global one, but the underlying query filters by `accountId` and the cache
 * key is per-account so each account detail keeps its own slice.
 *
 * Renders the block inside a peer card surface so it sits visually next to
 * the navy hero card and the movements card (see /accounts/[id] composition).
 */
export function PendingReimbursementsAccountContainer({ accountId }: Props) {
  const { data, isPending, error } = useQuery({
    queryKey: QUERY_KEYS.accountPendingReimbursements(accountId),
    queryFn: () => getPendingReimbursements(createClient(), accountId),
  })

  if (isPending) return null
  if (error || !data || data.length === 0) return null

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <PendingReimbursementsBlock pending={data} todayISO={formatDateISO(getTodayAR())} />
    </div>
  )
}
