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
 * Free-text match against a movement's user-visible fields (title, description,
 * account, destination account on transfers). Used by both server-side query
 * filtering (`getGlobalMovementsPage`) and client-side filtering on the
 * /accounts/[id] shell.
 */
export const movementMatchesText = (movement: FinancialMovement, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-AR')
  if (!normalizedQuery) return true

  const haystack = [
    movement.title,
    movement.description,
    movement.account_name,
    movement.kind === 'transfer' ? movement.destination_account_name : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es-AR')

  return haystack.includes(normalizedQuery)
}
