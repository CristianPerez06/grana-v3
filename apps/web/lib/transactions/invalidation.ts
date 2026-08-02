import type { QueryClient } from '@tanstack/react-query'

// Keep this list in sync with the revalidatePath helpers in
// `app/_actions/_helpers.ts`. Client-side invalidations refetch the TanStack
// cache for the active client routes (/transactions, /accounts/[id]); the
// server-side revalidatePath helpers ensure the other RSC routes (/dashboard,
// /cards, /accounts list, etc.) refetch on next navigation.
//
// Helpers below take a QueryClient (which the caller obtains via
// `useQueryClient()`) and call `invalidateQueries` by KEY PREFIX, which
// matches every nested key beneath. New queries that join an existing prefix
// (e.g. another `['transactions','breakdown', ...]` variant) inherit the
// invalidation automatically — keys without an existing prefix must be added
// here explicitly.

export function invalidateAfterMovementMutation(qc: QueryClient): void {
  // A movement was created, edited, or deleted. Affects the list, the month
  // breakdowns, the filter-options universe (if a new account/category combo
  // was introduced), the has-any signal (first-ever movement), the pending
  // reimbursements (if linked), the top recurrence suggestion, and the
  // accounts (balances changed). Account-scoped views read these keys
  // explicitly because they don't share a prefix with the global list.
  qc.invalidateQueries({ queryKey: ['transactions', 'page'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'breakdown'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'category-lines'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'filter-options'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'has-any'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'pending-reimbursements'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'linked-recurrence-ids'] })
  qc.invalidateQueries({ queryKey: ['recurrences', 'top-suggestion'] })
  qc.invalidateQueries({ queryKey: ['accounts', 'list'] })
  // Dashboard client widgets (balance series, category breakdown, and any
  // future `['dashboard', ...]` query) read from TanStack, not RSC, so
  // router.refresh() alone leaves them stale until a hard reload. Invalidate
  // the whole prefix so every dashboard card refetches after a movement.
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  // Compartido home month-scoped widgets (Gasto del hogar, Últimos movimientos)
  // read from TanStack keyed by month; router.refresh() alone leaves them stale.
  // Debt/outlook there are today-anchored RSC and refresh via router.refresh().
  qc.invalidateQueries({ queryKey: ['shared'] })
  // /accounts/[id] shell: detail balances + ascending history + scoped
  // pending reimbursements. We invalidate by the `account` / `reimbursements`
  // prefixes so each account's slice refreshes without callers needing to
  // know which `accountId` was touched.
  qc.invalidateQueries({ queryKey: ['account', 'detail'] })
  qc.invalidateQueries({ queryKey: ['account', 'movements-ascending'] })
  qc.invalidateQueries({ queryKey: ['reimbursements', 'pending', 'account'] })
}

/**
 * Invalidate the account-scoped keys after a mutation that affects the
 * account itself (archive, reactivate, delete, edit, currency add/deactivate).
 * Movement mutations should call `invalidateAfterMovementMutation` instead —
 * it already covers everything this helper does plus the movement-side keys.
 */
export function invalidateAfterAccountMutation(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['account', 'detail'] })
  qc.invalidateQueries({ queryKey: ['accounts', 'list'] })
  qc.invalidateQueries({ queryKey: ['institutions'] })
}

/**
 * Invalidate the category-scoped keys after creating/editing/archiving/deleting
 * a category or subcategory, so the movement form's category picker
 * (`categories tree`) and the filter options pick it up without a manual page
 * refresh.
 *
 * EVERY category mutation must call this — archive and delete included, not
 * just create. The mutations are server actions whose `revalidatePath` refreshes
 * only the settings route's RSC render; the picker reads the TanStack catalog,
 * cached with a 15-minute `staleTime` (`lib/query-client.ts`). Skipping the call
 * leaves an archived — or deleted — category on offer until that window expires.
 */
export function invalidateAfterCategoryMutation(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['categories'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'filter-options'] })
}

export function invalidateAfterRecurrenceInstanceMutation(
  qc: QueryClient,
  opts: { confirmed: boolean },
): void {
  // Skipping just removes the pending instance; confirming additionally
  // creates a real movement, so it ripples through everything a regular
  // movement mutation would touch.
  qc.invalidateQueries({ queryKey: ['recurrences', 'pending-instances'] })
  if (opts.confirmed) invalidateAfterMovementMutation(qc)
}

export function invalidateAfterReimbursementMutation(qc: QueryClient): void {
  // Confirming a reimbursement marks the existing expense as received (state
  // flips on the row); cancelling just removes it from the pending list.
  // Both change the list rendering, the pending block, and breakdowns when
  // the affected month is currently visible. Account balances also change.
  qc.invalidateQueries({ queryKey: ['transactions', 'pending-reimbursements'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'page'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'breakdown'] })
  qc.invalidateQueries({ queryKey: ['transactions', 'category-lines'] })
  qc.invalidateQueries({ queryKey: ['accounts', 'list'] })
  // Marking an expense received changes the month's spending, so the dashboard
  // balance/breakdown widgets must refetch too.
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  // Account detail view: balances + ascending history + scoped pending list.
  qc.invalidateQueries({ queryKey: ['account', 'detail'] })
  qc.invalidateQueries({ queryKey: ['account', 'movements-ascending'] })
  qc.invalidateQueries({ queryKey: ['reimbursements', 'pending', 'account'] })
}

export function invalidateAfterSuggestionMutation(qc: QueryClient): void {
  // Accepting or dismissing the top suggestion consumes it; the next one (if
  // any) takes its place. No movement is created by the action itself, so the
  // list / breakdowns don't change here.
  qc.invalidateQueries({ queryKey: ['recurrences', 'top-suggestion'] })
}
