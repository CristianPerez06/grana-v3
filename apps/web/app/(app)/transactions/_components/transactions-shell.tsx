'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FiltersProvider } from '@/lib/transactions/filters-context'
import { generateDueRecurrenceInstancesAction } from '@/app/_actions/recurrences'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { TransactionsContent } from './transactions-content'

/**
 * Top-level client shell for /transactions. The TanStack QueryClient is now
 * mounted at the (app) layout level (`AppQueryProvider`), so this shell only
 * has to add the route-specific filters context on top of it.
 *
 * It also owns the lazy materialization of due recurrence instances:
 * fired-and-forgotten on mount so it never blocks the read path
 * (web-data-access spec). When something was generated, the affected queries
 * are invalidated so the new pending instance appears without a reload.
 */
export function TransactionsShell() {
  const queryClient = useQueryClient()
  const generationFired = useRef(false)

  useEffect(() => {
    if (generationFired.current) return
    generationFired.current = true
    generateDueRecurrenceInstancesAction()
      .then(({ created }) => {
        if (created === 0) return
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recurrencesPendingInstances })
        queryClient.invalidateQueries({ queryKey: ['transactions', 'page'] })
      })
      .catch(() => {
        // Best-effort: a failed generation just means the instance shows up on
        // the next visit. The read path must never depend on it.
      })
  }, [queryClient])

  return (
    <FiltersProvider>
      <TransactionsContent />
    </FiltersProvider>
  )
}
