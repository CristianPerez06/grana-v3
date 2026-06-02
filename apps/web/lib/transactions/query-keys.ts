import type { MovementFilters as MovementFiltersState } from './filters'

// Canonical TanStack Query keys for the /transactions route, plus the few
// cross-route keys it consumes (accounts, categories, household). Single source
// so consumers (`useQuery` callers and the invalidation helpers in PR 3) share
// exact prefixes without drifting. Keys are arrays — TanStack treats them
// structurally, but importing the constant avoids accidental shape changes.

export const QUERY_KEYS = {
  // Drawer / form data — long staleTime, used to gate the header button.
  accountsList: ['accounts', 'list'] as const,
  categoriesTree: ['categories', 'tree'] as const,
  householdDetail: ['household', 'detail'] as const,

  // /transactions sections. Keyed on the projected query shape + limit so
  // unrelated React state (overview mode, etc.) does not invalidate the cache.
  transactionsPage: (limit: number, filters: MovementFiltersState) =>
    ['transactions', 'page', limit, filters] as const,
  transactionsLinkedRecurrenceIds: (txIds: readonly string[]) =>
    ['transactions', 'linked-recurrence-ids', txIds] as const,
  transactionsFilterOptions: (categoryId: string | null) =>
    ['transactions', 'filter-options', categoryId] as const,
  transactionsPendingReimbursements: ['transactions', 'pending-reimbursements'] as const,
  transactionsHasAny: ['transactions', 'has-any'] as const,

  // Spending overview breakdowns — keyed by what the underlying query needs.
  breakdownExpense: (month: string) =>
    ['transactions', 'breakdown', 'expense', month] as const,
  breakdownExpenseSubcategory: (month: string, categoryId: string) =>
    ['transactions', 'breakdown', 'expense', month, 'subcategory', categoryId] as const,
  breakdownIncome: (month: string) =>
    ['transactions', 'breakdown', 'income', month] as const,
  breakdownUsdActivity: (month: string) =>
    ['transactions', 'breakdown', 'usd-activity', month] as const,

  // Recurrences side-car queries.
  recurrencesPendingInstances: ['recurrences', 'pending-instances'] as const,
  recurrencesTopSuggestion: ['recurrences', 'top-suggestion'] as const,
} as const
