import { resolveMonthRange } from '@grana/dashboard'
import type { FinancialMovement } from './movements'

export { resolveMonthRange }

export type MovementTypeFilter = FinancialMovement['kind']
export type MovementCurrencyFilter = 'ARS' | 'USD'

/**
 * Sentinel for the "no subcategory assigned" filter. Distinct from `null` so
 * the query layer can disambiguate "no filter" (absent) from "rows whose
 * `subcategory_id IS NULL`" (this marker). Used by both the filter UI sheet
 * and the server-side queries that translate it into the right SQL.
 */
export const SUBCATEGORY_NONE_MARKER = '__none__'

/**
 * Shape the queries expect — the projection of the React-state filters onto
 * the underlying server contract. `adaptFiltersForQuery` in web's
 * `filters-state.ts` is the canonical translator.
 */
export type MovementFilters = {
  query?: string
  /** Selected month as `YYYY-MM` (period navigation). Absent when a custom range is used. */
  month?: string
  /** Custom date range (takes priority over `month`). */
  from?: string
  to?: string
  type?: MovementTypeFilter
  accountId?: string
  categoryId?: string
  /**
   * Subcategory id, or `SUBCATEGORY_NONE_MARKER` for "no subcategory assigned".
   * Only set when `categoryId` is also set — the filter UI enforces this.
   */
  subcategoryId?: string
  currency?: MovementCurrencyFilter
  amountMin?: number
  amountMax?: number
  /**
   * When `true`, the query excludes shared (Compartido) movements
   * (`is_shared = true`). Absent/false ⇒ shared movements are included. Driven
   * by the global module's "show shared" toggle (a persisted view preference).
   */
  excludeShared?: boolean
}

export const DEFAULT_MOVEMENTS_LIMIT = 50
export const MOVEMENTS_LIMIT_STEP = 50
export const MAX_MOVEMENTS_LIMIT = 500

export const MOVEMENT_TYPE_KEYS: ReadonlyArray<MovementTypeFilter> = [
  'income',
  'expense',
  'reimbursement',
  'card_payment',
  'transfer',
  'exchange',
  'adjustment',
  'installment_purchase',
]

/** `YYYY-MM` of a date. */
export const monthOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** Shift a `YYYY-MM` month by `delta` months. */
export const shiftMonth = (month: string, delta: number): string => {
  const [year, m] = month.split('-').map(Number)
  return monthOf(new Date(year, m - 1 + delta, 1))
}

/**
 * Free-text match against a movement's visible text. THE canonical declaration
 * of the searchable field set, in code — the `ilike` clause of the
 * `get_movements_page` RPC mirrors this same set in SQL for the paginated feeds
 * (see `supabase/migrations/0057_get_movements_page_search_fields.sql`). Changing
 * what is searchable means changing BOTH; the two cannot share code, so they
 * point at each other.
 *
 * This function serves the two account-detail surfaces (web and mobile), which
 * filter in memory because they hold the account's full history. The two feed
 * surfaces (`/transactions`, the native Movimientos tab) paginate, so their match
 * runs in the database — filtering a partial page would answer a different
 * question than the user asked.
 *
 * IN the set:
 *   1. the derived `title` (the category name on income/expense; the fixed label
 *      on transfer / exchange / card payment / adjustment)
 *   2. the effective `description` (a reimbursement inherits its expense's)
 *   3. the source account name, and 4. its institution name
 *   5. the destination account name, and 6. its institution name — on `transfer`
 *      AND `exchange`, the two kinds that have a second end
 *
 * The institution is in because it is the account's PRIMARY text on the row
 * (`institutionName?.trim() || name`): the user reads "Galicia", not the name
 * they gave the account, and no dedicated filter reaches it.
 *
 * OUT of the set, deliberately:
 *   • Category and subcategory as an explicit axis — both have a dedicated,
 *     precise filter, and the category already comes in through `title` on
 *     income/expense, which is the case that matters (an expense with no
 *     description IS titled by its category). Adding them would only change the
 *     result on the kinds whose title is a fixed label.
 *   • Amount and date — `amountMin`/`amountMax` and the month/range already own
 *     those axes; matching them as text would mean normalizing number formats
 *     for nothing.
 *   • `canonical_name` — an internal translation slug, not text the user sees.
 *
 * Known limit: the match runs over the STORED text, not its rendered label. What
 * the user typed matches in any locale; what Grana generates does not — system
 * categories are stored in Spanish and rendered translated, and the row's type
 * label is translated at render (`t(typeLabelKey[kind])`) rather than read off
 * `title`. Pre-existing; closing it means moving the title derivation out of SQL.
 */
export const movementMatchesText = (movement: FinancialMovement, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-AR')
  if (!normalizedQuery) return true

  // The destination fields live only on the two-ended kinds, so the union needs
  // an `in` narrowing — but no kind check: `transfer` and `exchange` are exactly
  // the kinds that declare them, which is the rule we want.
  const hasDestination = 'destination_account_name' in movement

  const haystack = [
    movement.title,
    movement.description,
    movement.account_name,
    movement.account_institution_name,
    hasDestination ? movement.destination_account_name : null,
    hasDestination ? movement.destination_account_institution_name : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es-AR')

  return haystack.includes(normalizedQuery)
}
