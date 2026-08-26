import {
  DEFAULT_MOVEMENTS_LIMIT,
  type MovementCurrencyFilter,
  type MovementFilters,
  type MovementTypeFilter,
} from '@grana/transactions'

// Movement filters state for the native surfaces. Native analogue of web's
// `TransactionsFilters` (`apps/web/lib/transactions/filters-state.ts`), trimmed
// to what mobile ships:
//
//   - no `customRange`: mobile navigates by month only. Web declares the field
//     but no UI ever sets it, so adding it here would put native AHEAD of web
//     rather than at parity — see issue #77, which decides for both platforms.
//   - no `showShared`: it is a persisted VIEW PREFERENCE, not a chip filter, so
//     porting it means native storage. See issue #76.
//   - no `overviewMode`: the category breakdown is a web-only surface.
//
// Both native surfaces share this SHAPE, not the way they apply it: the global
// feed projects it to `MovementFilters` and lets the RPC filter (it paginates,
// so filtering a partial page would be wrong); the account detail filters its
// fully-loaded history in memory. See the `transactions` / `accounts` specs.
export type MovementFiltersState = {
  /** Selected month as `YYYY-MM`. */
  month: string
  /** Free-text search. */
  query: string
  /**
   * Movement kind — the DERIVED axis (`FinancialMovement['kind']`), not the
   * `transaction_type` DB column. It is what `MovementFilters.type` declares and
   * what the RPC compares, and it carries the three distinctions the user
   * already sees on the row badges: installments, statement payment, refund.
   */
  type: MovementTypeFilter | null
  accountId: string | null
  categoryId: string | null
  /** Only meaningful with a category selected; the filters sheet enforces it. */
  subcategoryId: string | null
  currency: MovementCurrencyFilter | null
  amountMin: number | null
  amountMax: number | null
}

export function emptyFilters(month: string): MovementFiltersState {
  return {
    month,
    query: '',
    type: null,
    accountId: null,
    categoryId: null,
    subcategoryId: null,
    currency: null,
    amountMin: null,
    amountMax: null,
  }
}

/**
 * Active CONTENT-filter count for the "Filtros" badge. Excludes `month` and
 * `query`: both have their own controls, so counting them would make the badge
 * describe something other than what the sheet holds. Mirror of web's
 * `hasActiveContentFilters`.
 */
export function activeFilterCount(filters: MovementFiltersState): number {
  let n = 0
  if (filters.type) n++
  if (filters.accountId) n++
  if (filters.categoryId) n++
  if (filters.subcategoryId) n++
  if (filters.currency) n++
  if (filters.amountMin != null) n++
  if (filters.amountMax != null) n++
  return n
}

export function hasActiveContentFilters(filters: MovementFiltersState): boolean {
  return activeFilterCount(filters) > 0
}

export function hasActiveSearch(filters: MovementFiltersState): boolean {
  return filters.query.trim().length > 0
}

/** Clear the content filters, keeping month and search (each has its own control). */
export function clearContentFilters(filters: MovementFiltersState): MovementFiltersState {
  return { ...emptyFilters(filters.month), query: filters.query }
}

/** Clear the content filters AND the search. Drives the no-results empty state. */
export function clearFiltersAndSearch(filters: MovementFiltersState): MovementFiltersState {
  return emptyFilters(filters.month)
}

/**
 * Project the React-state filters onto the `MovementFilters` contract the shared
 * read expects. Empty fields stay ABSENT (undefined) rather than explicit null,
 * matching the query's "absent ⇒ no constraint" contract.
 *
 * Pure and deterministic on purpose: this projection is the TanStack cache
 * identity of the feed, so two equal filter states must produce the same object.
 * Mirror of web's `adaptFiltersForQuery`.
 */
export function adaptFiltersForQuery(filters: MovementFiltersState): MovementFilters {
  const out: MovementFilters = { month: filters.month }
  const query = filters.query.trim()
  if (query) out.query = query
  if (filters.type) out.type = filters.type
  if (filters.accountId) out.accountId = filters.accountId
  if (filters.categoryId) out.categoryId = filters.categoryId
  if (filters.subcategoryId) out.subcategoryId = filters.subcategoryId
  if (filters.currency) out.currency = filters.currency
  if (filters.amountMin != null) out.amountMin = filters.amountMin
  if (filters.amountMax != null) out.amountMax = filters.amountMax
  // `excludeShared` is never projected: hiding shared movements is issue #76.
  return out
}

export { DEFAULT_MOVEMENTS_LIMIT }
