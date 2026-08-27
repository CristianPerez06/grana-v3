import { resolveMonthRange } from '@grana/dashboard'
import { getTodayAR } from '@grana/money-logic'
import { movementMatchesText, type FinancialMovement, type TransactionWithDetails } from '@grana/transactions'
import type { Locale } from '../locale'
import type { MovementFiltersState } from '../transactions/feed-filters'

// The filters SHAPE now lives with the feed (`lib/transactions/feed-filters.ts`)
// so the account detail and the global Movimientos tab share one sheet and one
// state type. What stays here is what belongs to THIS surface: the in-memory
// application of those filters over the account's fully-loaded history, and the
// month labels the inline navigator renders.
//
// The account detail filters in memory and the feed filters in the database —
// see `applyAccountFilters` below for why that is correct and why it is not a
// difference in WHAT matches.
export type AccountMovementFilters = MovementFiltersState

// ── Month helpers ──────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function currentMonth(): string {
  return monthOf(getTodayAR())
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return monthOf(new Date(y, m - 1 + delta, 1))
}

const FULL_MONTHS: Record<Locale, readonly string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${FULL_MONTHS[locale][m - 1]} ${y}`
}

// The state factory and the badge counter live with the shared shape. Re-exported
// here so this surface keeps importing its filter vocabulary from one module.
export {
  emptyFilters,
  activeFilterCount,
  hasActiveContentFilters,
  hasActiveSearch,
  clearContentFilters,
} from '../transactions/feed-filters'

// ── Application ──────────────────────────────────────────────────────────────

// Apply the month range + content filters + search to the account's movements.
// Pure; mirror of web's `applyAccountFilters` over the native row model.
//
// `movementById` carries the DERIVED `FinancialMovement` per row, which this
// function needs for two things. The type axis is `kind` (what `MovementFilters`
// declares and the RPC compares), not the `transaction_type` column, so the
// shared filters sheet speaks one language on both surfaces. And the free-text
// match is `movementMatchesText` of `@grana/transactions` — the SAME function
// web's account detail uses, not a native copy of it: the searchable field set
// is declared once, and a parallel native matcher is exactly the
// "mirror … keep in sync" pattern that drifted this search apart in the first
// place. The caller derives the map once per load with `toFinancialMovement` —
// the single kind derivation in the repo — rather than re-typing the rules here.
//
// This surface filters in MEMORY while the global feed filters in the DATABASE.
// That is not drift, and it is not a divergence in what matches: both run the
// same field set. It follows from how the two read — the detail loads the
// account's whole history (it needs it for the per-row running balance), while
// the feed paginates, so filtering a partial page there would answer a different
// question than the user asked. Do not "fix" the feed by filtering its page.
export function applyAccountFilters(
  movements: TransactionWithDetails[],
  filters: AccountMovementFilters,
  movementById: Map<string, FinancialMovement>,
): TransactionWithDetails[] {
  const { from, to } = resolveMonthRange(filters.month)
  return movements.filter((tx) => {
    if (tx.date < from || tx.date > to) return false
    if (filters.type && movementById.get(tx.id)?.kind !== filters.type) return false
    if (filters.currency && tx.currency_code !== filters.currency) return false
    if (filters.accountId && tx.account_id !== filters.accountId) return false
    if (filters.categoryId && tx.category_id !== filters.categoryId) return false
    if (filters.subcategoryId && tx.subcategory_id !== filters.subcategoryId) return false
    if (filters.amountMin != null && tx.amount < filters.amountMin) return false
    if (filters.amountMax != null && tx.amount > filters.amountMax) return false
    if (filters.query) {
      const movement = movementById.get(tx.id)
      if (!movement || !movementMatchesText(movement, filters.query)) return false
    }
    return true
  })
}
