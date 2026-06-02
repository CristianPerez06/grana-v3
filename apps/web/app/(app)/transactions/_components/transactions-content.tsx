'use client'

import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { CategorySpendingOverviewContainer } from './category-spending-overview-container'
import { MovementDrawerLoader } from './movement-drawer-loader'
import { MovementFiltersContainer } from './movement-filters-container'
import { MovementListContainer } from './movement-list-container'
import { PendingRecurrencesBlockContainer } from './pending-recurrences-block-container'
import { PendingReimbursementsBlockContainer } from './pending-reimbursements-block-container'
import { RecurrenceSuggestionBannerContainer } from './recurrence-suggestion-banner-container'
import { TransactionsHeader } from './transactions-header'

/**
 * Visual content of the /transactions route. Mounts the header (always
 * visible), each side-car section (independent useQuery), and the mobile FAB
 * — all wrapped by the drawer loader so any of them can trigger the create
 * drawer once the data is ready.
 *
 * Sections still pending migration (group 7 of the change):
 *   - <CategorySpendingOverview>    needs filters context wiring
 *   - <MovementFilters>             needs filters context wiring (chips → dispatch)
 *   - <MovementList>                needs filters context + empty-state rewrite
 */
export function TransactionsContent() {
  return (
    <MovementDrawerLoader>
      <div className="flex max-w-3xl flex-col gap-6 pb-24 sm:pb-0">
        <TransactionsHeader />
        <RecurrenceSuggestionBannerContainer />
        <PendingRecurrencesBlockContainer />
        <CategorySpendingOverviewContainer />
        <PendingReimbursementsBlockContainer />
        <MovementFiltersContainer />
        <MovementListContainer />
        <QuickAddFab />
      </div>
    </MovementDrawerLoader>
  )
}
