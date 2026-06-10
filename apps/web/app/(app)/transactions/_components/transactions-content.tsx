'use client'

import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { CategorySpendingOverviewContainer } from './category-spending-overview-container'
import { MovementFiltersContainer } from './movement-filters-container'
import { MovementListContainer } from './movement-list-container'
import { PendingRecurrencesBlockContainer } from './pending-recurrences-block-container'
import { PendingReimbursementsBlockContainer } from './pending-reimbursements-block-container'
import { RecurrenceSuggestionBannerContainer } from './recurrence-suggestion-banner-container'

/**
 * Visual content of /transactions. The route shell (header + drawer loader +
 * outer flex wrapper) lives in `transactions/layout.tsx`. This component lays
 * out the existing sections in a two-column grid:
 *
 *   ┌──────────────────────────────┬────────────────────────┐
 *   │  overview                    │  recurrence suggestion │
 *   │  ledger (toolbar + list)     │  pending recurrences   │
 *   │                              │  pending reimbursements│
 *   └──────────────────────────────┴────────────────────────┘
 *
 * Narrow widths collapse to a single column; the side blocks pull to the top
 * because they represent pending user tasks (see route-ui-system.md → "Mobile").
 * No queries, totals, or data are introduced here — only layout.
 */
export function TransactionsContent() {
  return (
    <>
      {/* `has-[aside:empty]:lg:grid-cols-1` collapses the side column when all
          three conditional containers render null, so the main column fills
          the full width instead of leaving a blank 340px gutter. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:has-[aside:empty]:grid-cols-1">
        <section className="flex min-w-0 flex-col gap-4">
          <CategorySpendingOverviewContainer />
          <section className="flex flex-col gap-3">
            <MovementFiltersContainer />
            <MovementListContainer />
          </section>
        </section>
        <aside className="order-first flex flex-col gap-4 empty:hidden lg:order-none">
          <RecurrenceSuggestionBannerContainer />
          <PendingRecurrencesBlockContainer />
          <PendingReimbursementsBlockContainer />
        </aside>
      </div>
      <QuickAddFab />
    </>
  )
}
