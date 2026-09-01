'use client'

import { useQuery } from '@tanstack/react-query'
import { getCommittedOutlookForMonth, type CommittedOutlook } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/client'
import { useDashboardMonth } from './dashboard-month-context'

/**
 * The committed card's data for the SELECTED month.
 *
 * The window is the month AFTER the selected one, and the state of each
 * commitment is evaluated at that month's close (today for the current month).
 * Both come back on the result — the card labels itself from them rather than
 * recomputing the month from a clock of its own, which is what kept it naming
 * the month after the real today no matter where the navigator stood.
 *
 * Same shape as `use-balance-month.ts`: the current month arrives
 * server-rendered as `initialData`, and only a move off it goes to the network.
 */
export const useCommittedMonth = (initialData: CommittedOutlook | null) => {
  const { selected, isCurrent } = useDashboardMonth()

  const query = useQuery({
    queryKey: ['dashboard', 'committed', selected.year, selected.month],
    queryFn: () =>
      getCommittedOutlookForMonth(createClient(), {
        year: selected.year,
        month: selected.month,
      }),
    initialData: isCurrent ? (initialData ?? undefined) : undefined,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    /**
     * True only while an uncached month is in flight. The current month resolves
     * from `initialData`, so this turns on when navigating — where the card would
     * otherwise render another month's numbers under this month's heading.
     */
    isLoading: query.isPending,
    isError: query.isError,
  }
}
