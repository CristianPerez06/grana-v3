'use client'

import { FiltersProvider } from '@/lib/transactions/filters-context'
import { TransactionsContent } from './transactions-content'

/**
 * Top-level client shell for /transactions. The TanStack QueryClient is mounted
 * at the (app) layout level (`AppQueryProvider`), so this shell only adds the
 * route-specific filters context on top of it.
 *
 * It no longer materializes due occurrences. That moved to the app layout
 * (`RecurrenceMaterializationProvider`): tying it to this route meant a user who
 * opened the app on the dashboard and stayed there never materialized anything.
 */
export function TransactionsShell() {
  return (
    <FiltersProvider>
      <TransactionsContent />
    </FiltersProvider>
  )
}
