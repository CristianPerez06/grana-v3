'use client'

import { useQuery } from '@tanstack/react-query'
import { PendingReimbursementsBlock } from '@/lib/transactions/components/pending-reimbursements-block'
import { getPendingReimbursementsAction } from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { formatDateISO, getTodayAR } from '@/lib/date'

type Props = {
  accountId: string
}

/**
 * Account-scoped variant of the pending reimbursements container. Same as the
 * global one, but the underlying query filters by `accountId` and the cache
 * key is per-account so each account detail keeps its own slice.
 */
export function PendingReimbursementsAccountContainer({ accountId }: Props) {
  const { data, isPending, error } = useQuery({
    queryKey: QUERY_KEYS.accountPendingReimbursements(accountId),
    queryFn: () => getPendingReimbursementsAction(accountId),
  })

  if (isPending) return null
  if (error || !data) return null

  return <PendingReimbursementsBlock pending={data} todayISO={formatDateISO(getTodayAR())} />
}
