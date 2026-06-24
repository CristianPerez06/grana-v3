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
 * outer flex wrapper) lives in `transactions/layout.tsx`. This component stacks
 * the sections in a single column:
 *
 *   ┌──────────────────────────────┐
 *   │  recurrence suggestion       │
 *   │  pending recurrences         │
 *   │  pending reimbursements      │
 *   │  overview                    │
 *   │  ledger (toolbar + list)     │
 *   └──────────────────────────────┘
 *
 * The recurrence suggestion, the pending-recurrences hub AND the pending
 * reimbursements are collapsible "por confirmar" notices stacked full-width
 * above the spending overview. The reimbursements block used to sit in a 340px
 * side column, which shrank the overview chart; it now lives inline with the
 * other notices so every aviso reads top-to-bottom. No queries/totals here —
 * only layout.
 */
export function TransactionsContent() {
  return (
    <>
      <section className="flex min-w-0 flex-col gap-4">
        <RecurrenceSuggestionBannerContainer />
        <PendingRecurrencesBlockContainer />
        <PendingReimbursementsBlockContainer />
        <CategorySpendingOverviewContainer />
        <section className="flex flex-col gap-3">
          <MovementFiltersContainer />
          <MovementListContainer />
        </section>
      </section>
      <QuickAddFab />
    </>
  )
}
