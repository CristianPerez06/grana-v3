'use client'

import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { CategorySpendingOverviewContainer } from './category-spending-overview-container'
import { MovementFiltersContainer } from './movement-filters-container'
import { MovementListContainer } from './movement-list-container'
import { PendingRecurrencesBlockContainer } from './pending-recurrences-block-container'
import { PendingReimbursementsBlockContainer } from './pending-reimbursements-block-container'
import { RecurrenceSuggestionBannerContainer } from './recurrence-suggestion-banner-container'

/**
 * Visual content of the /transactions route. Header, drawer loader and the
 * outer flex wrapper live in `transactions/layout.tsx`; this component renders
 * the sections as direct siblings inside that shared flex container.
 *
 * Sections still pending migration (group 7 of the change):
 *   - <CategorySpendingOverview>    needs filters context wiring
 *   - <MovementFilters>             needs filters context wiring (chips → dispatch)
 *   - <MovementList>                needs filters context + empty-state rewrite
 */
export function TransactionsContent() {
  return (
    <>
      <RecurrenceSuggestionBannerContainer />
      <PendingRecurrencesBlockContainer />
      <CategorySpendingOverviewContainer />
      <PendingReimbursementsBlockContainer />
      <MovementFiltersContainer />
      <MovementListContainer />
      <QuickAddFab />
    </>
  )
}
