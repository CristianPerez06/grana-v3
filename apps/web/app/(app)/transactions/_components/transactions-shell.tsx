'use client'

import { FiltersProvider } from './filters-context'
import { TransactionsContent } from './transactions-content'

/**
 * Top-level client shell for /transactions. The TanStack QueryClient is now
 * mounted at the (app) layout level (`AppQueryProvider`), so this shell only
 * has to add the route-specific filters context on top of it.
 */
export function TransactionsShell() {
  return (
    <FiltersProvider>
      <TransactionsContent />
    </FiltersProvider>
  )
}
