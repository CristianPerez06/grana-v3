import { getTodayAR } from '@/lib/date'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  monthOf,
  shiftMonth,
  type MovementCurrencyFilter,
  type MovementTypeFilter,
} from './filters'

export type OverviewMode = 'egresos' | 'ingresos'

export type TransactionsFilters = {
  /** Selected month as `YYYY-MM`. Ignored when `customRange` is set. */
  month: string
  /** Custom date range; when present, takes priority over `month`. */
  customRange: { from?: string; to?: string } | null
  /**
   * Active currency filter. `null` means "show both currencies" (matches the
   * legacy URL behavior where `?currency=` absent = no filter); the spending
   * overview falls back to ARS visualization in that case.
   */
  currency: MovementCurrencyFilter | null
  overviewMode: OverviewMode
  type: MovementTypeFilter | null
  accountId: string | null
  categoryId: string | null
  /** Only meaningful when `categoryId` is set; reducer enforces this. */
  subcategoryId: string | null
  /** Search query (free text). */
  query: string
  amountMin: number | null
  amountMax: number | null
  /**
   * Whether shared (Compartido) movements are shown in the global list. Unlike
   * the chip-removable filters above, this is a **persisted view preference**
   * (see the global container): it survives reloads, is not a removable chip,
   * and does not count toward "active filters". Defaults to `true`.
   */
  showShared: boolean
  limit: number
}

export type TransactionsFiltersAction =
  | { type: 'setMonth'; month: string }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' }
  | { type: 'setCustomRange'; range: { from?: string; to?: string } | null }
  | { type: 'setCurrency'; currency: MovementCurrencyFilter | null }
  | { type: 'setOverviewMode'; mode: OverviewMode }
  | { type: 'setType'; movementType: MovementTypeFilter | null }
  | { type: 'setAccount'; accountId: string | null }
  | { type: 'setCategory'; categoryId: string | null }
  | { type: 'setSubcategory'; subcategoryId: string | null }
  | { type: 'setQuery'; query: string }
  | { type: 'setShowShared'; value: boolean }
  | { type: 'setAmountRange'; min: number | null; max: number | null }
  | { type: 'setLimit'; limit: number }
  | { type: 'incrementLimit' }
  | { type: 'clearSearch' }
  | { type: 'clearFilters' }
  | { type: 'clearAll' }
  | { type: 'reset' }

/**
 * Build the initial filters state. Pure factory — does not read any global
 * mutable state; the only "now" it depends on is `getTodayAR()` for the
 * default month. Callers (FiltersProvider, tests) pass it in for full
 * determinism.
 */
export function createInitialFilters(
  options: { today?: Date; showShared?: boolean } = {},
): TransactionsFilters {
  const today = options.today ?? getTodayAR()
  return {
    month: monthOf(today),
    customRange: null,
    currency: null,
    overviewMode: 'egresos',
    type: null,
    accountId: null,
    categoryId: null,
    subcategoryId: null,
    query: '',
    amountMin: null,
    amountMax: null,
    showShared: options.showShared ?? true,
    limit: DEFAULT_MOVEMENTS_LIMIT,
  }
}

const clampLimit = (n: number): number =>
  Math.max(DEFAULT_MOVEMENTS_LIMIT, Math.min(n, MAX_MOVEMENTS_LIMIT))

export function transactionsFiltersReducer(
  state: TransactionsFilters,
  action: TransactionsFiltersAction,
): TransactionsFilters {
  switch (action.type) {
    case 'setMonth':
      // Setting a month clears a custom range, since they're mutually exclusive.
      return { ...state, month: action.month, customRange: null, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'prevMonth':
      // Month nav while a custom range is active is a no-op — the user has to
      // clear the range first (matches the contract that customRange wins).
      if (state.customRange) return state
      return {
        ...state,
        month: shiftMonth(state.month, -1),
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'nextMonth':
      if (state.customRange) return state
      return {
        ...state,
        month: shiftMonth(state.month, +1),
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'setCustomRange':
      return { ...state, customRange: action.range, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setCurrency':
      return { ...state, currency: action.currency, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setOverviewMode': {
      // Mode toggle (Egresos / Ingresos). The drill filters belong to the mode
      // that set them: an income row pins `type=income` + its category, an
      // expense row pins a category (+ subcategory). Flipping the mode drops
      // them, or the list keeps showing the previous mode's rows under a card
      // that no longer explains them (the "stuck Ingresos chip"). Month,
      // currency, search, account and amounts are the user's own filters and
      // stay. The limit resets only when a drill filter actually went away:
      // a bare toggle must not collapse a list the user had expanded.
      if (action.mode === state.overviewMode) return state
      const hadDrill =
        state.type !== null || state.categoryId !== null || state.subcategoryId !== null
      return {
        ...state,
        overviewMode: action.mode,
        type: null,
        categoryId: null,
        subcategoryId: null,
        limit: hadDrill ? DEFAULT_MOVEMENTS_LIMIT : state.limit,
      }
    }
    case 'setType':
      return { ...state, type: action.movementType, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setAccount':
      return { ...state, accountId: action.accountId, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setCategory':
      // Category change invalidates subcategory (a subcategory belongs to one
      // category — keeping it across category changes leaks state).
      return {
        ...state,
        categoryId: action.categoryId,
        subcategoryId: null,
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'setSubcategory':
      // Subcategory without a parent category is meaningless; drop silently.
      if (!state.categoryId) return state
      return { ...state, subcategoryId: action.subcategoryId, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setQuery':
      return { ...state, query: action.query, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setShowShared':
      // Persisted view preference (not a chip filter). Reset the page limit so
      // pagination restarts cleanly when the visible set changes.
      return { ...state, showShared: action.value, limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'setAmountRange':
      return {
        ...state,
        amountMin: action.min,
        amountMax: action.max,
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'setLimit':
      return { ...state, limit: clampLimit(action.limit) }
    case 'incrementLimit':
      return { ...state, limit: clampLimit(state.limit + MOVEMENTS_LIMIT_STEP) }
    case 'clearSearch':
      return { ...state, query: '', limit: DEFAULT_MOVEMENTS_LIMIT }
    case 'clearFilters':
      // Clears chip-removable filters (type, account, category/subcategory,
      // currency, amount). Keeps period navigation, search, overview mode.
      return {
        ...state,
        type: null,
        accountId: null,
        categoryId: null,
        subcategoryId: null,
        currency: null,
        amountMin: null,
        amountMax: null,
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'clearAll':
      // Same as clearFilters but also wipes search.
      return {
        ...state,
        type: null,
        accountId: null,
        categoryId: null,
        subcategoryId: null,
        currency: null,
        amountMin: null,
        amountMax: null,
        query: '',
        limit: DEFAULT_MOVEMENTS_LIMIT,
      }
    case 'reset':
      // Full reset including period navigation, currency, overview mode.
      return createInitialFilters()
  }
}

/**
 * Whether the current filter set has at least one non-default content filter
 * active. Drives the "Filtros (N)" chip counter and the visibility of
 * "Limpiar filtros".
 */
export function hasActiveContentFilters(filters: TransactionsFilters): boolean {
  return Boolean(
    filters.type ||
      filters.accountId ||
      filters.categoryId ||
      filters.subcategoryId ||
      filters.currency != null ||
      filters.amountMin != null ||
      filters.amountMax != null,
  )
}

/**
 * Whether the user has a search term active. Drives the empty-state variant
 * picker (along with `hasActiveContentFilters`).
 */
export function hasActiveSearch(filters: TransactionsFilters): boolean {
  return filters.query.trim().length > 0
}

/**
 * Project the React-state filters onto the URL-style `MovementFilters` shape
 * the underlying query expects. Empty fields stay absent (undefined) instead
 * of explicit null, matching the query's "absent ⇒ no constraint" contract.
 *
 * Shared by both the filters container and the list container so they hit the
 * exact same TanStack queryKey (the projection is the cache identity), and so
 * a single source of truth governs how state translates into a fetch.
 */
export function adaptFiltersForQuery(
  filters: TransactionsFilters,
): import('./filters').MovementFilters {
  const out: import('./filters').MovementFilters = {}
  if (filters.customRange) {
    if (filters.customRange.from) out.from = filters.customRange.from
    if (filters.customRange.to) out.to = filters.customRange.to
  } else {
    out.month = filters.month
  }
  if (filters.query) out.query = filters.query
  if (filters.type) out.type = filters.type
  if (filters.accountId) out.accountId = filters.accountId
  if (filters.categoryId) out.categoryId = filters.categoryId
  if (filters.subcategoryId) out.subcategoryId = filters.subcategoryId
  if (filters.currency) out.currency = filters.currency
  if (filters.amountMin != null) out.amountMin = filters.amountMin
  if (filters.amountMax != null) out.amountMax = filters.amountMax
  // Only project the constraint when shared movements are hidden; when shown
  // (default) the field stays absent so the queryKey matches the legacy shape.
  if (!filters.showShared) out.excludeShared = true
  return out
}
