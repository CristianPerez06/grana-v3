'use client'

import { useQuery } from '@tanstack/react-query'
import { PendingReimbursementsBlock } from '@/lib/transactions/components/pending-reimbursements-block'
import { getPendingReimbursementsAction } from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { formatDateISO, getTodayAR } from '@/lib/date'

/**
 * Client wrapper for `<PendingReimbursementsBlock>`. Fetches pending
 * reimbursements via TanStack; the block itself handles its own empty state
 * (returns null when `pending.length === 0`), so we render unconditionally and
 * let it decide.
 *
 * Mutations inside the block (confirm / cancel) invalidate the relevant query
 * keys via `invalidateAfterReimbursementMutation` and the block updates in
 * place (alongside the downstream movement list).
 */
export function PendingReimbursementsBlockContainer() {
  const { data, isPending, error } = useQuery({
    queryKey: QUERY_KEYS.transactionsPendingReimbursements,
    queryFn: () => getPendingReimbursementsAction(),
  })

  if (isPending) {
    // Lightweight skeleton — the block is collapsed (height: 0) when there's
    // nothing to show, so during loading we mirror that and avoid a layout
    // shift when data resolves.
    return null
  }
  if (error || !data) return null

  return <PendingReimbursementsBlock pending={data} todayISO={formatDateISO(getTodayAR())} />
}
