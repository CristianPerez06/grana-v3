import { resolveMonthRange } from '@grana/dashboard'
import { getTodayAR } from '@grana/money-logic'
import type { MovementTypeFilter, TransactionWithDetails } from '@grana/transactions'
import type { Locale } from '../locale'
import type { MovementFiltersState } from '../transactions/feed-filters'

// The filters SHAPE now lives with the feed (`lib/transactions/feed-filters.ts`)
// so the account detail and the global Movimientos tab share one sheet and one
// state type. What stays here is what belongs to THIS surface: the in-memory
// application of those filters over the account's fully-loaded history, and the
// month labels the inline navigator renders.
//
// The account detail filters in memory and the feed filters in the database.
// That is not drift: the detail loads the account's whole history (it needs it
// for the per-row running balance), while the feed paginates — filtering a
// partial page there would answer a different question than the user asked.
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

// ── Matching + application ───────────────────────────────────────────────────────

// Free-text match over description, category name/canonical and the source /
// destination account names. Native analogue of web's `movementMatchesText`.
//
// NOTE: this matches MORE than the feed's search does. The feed's match runs in
// SQL (`get_movements_page`) over title, effective description and account
// names — it does NOT reach category names. The divergence follows from the
// feed filtering server-side and is documented in the `transactions` spec; do
// not "fix" it by filtering the feed's page in memory.
export function movementMatchesText(tx: TransactionWithDetails, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('es-AR')
  if (!normalized) return true
  const haystack = [
    tx.description,
    tx.category?.name,
    tx.category?.canonical_name,
    tx.subcategory?.name,
    tx.source_account?.name,
    tx.destination_account?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es-AR')
  return haystack.includes(normalized)
}

// Apply the month range + content filters + search to the account's movements.
// Pure; mirror of web's `applyAccountFilters` over the native row model.
//
// `kindById` carries the DERIVED movement kind per row. The type axis is `kind`
// (what `MovementFilters` declares and the RPC compares), not the
// `transaction_type` column, so the shared filters sheet speaks one language on
// both surfaces. The caller derives it once per load with `toFinancialMovement`
// — the single kind derivation in the repo — rather than re-typing the rules
// here.
export function applyAccountFilters(
  movements: TransactionWithDetails[],
  filters: AccountMovementFilters,
  kindById: Map<string, MovementTypeFilter>,
): TransactionWithDetails[] {
  const { from, to } = resolveMonthRange(filters.month)
  return movements.filter((tx) => {
    if (tx.date < from || tx.date > to) return false
    if (filters.type && kindById.get(tx.id) !== filters.type) return false
    if (filters.currency && tx.currency_code !== filters.currency) return false
    if (filters.accountId && tx.account_id !== filters.accountId) return false
    if (filters.categoryId && tx.category_id !== filters.categoryId) return false
    if (filters.subcategoryId && tx.subcategory_id !== filters.subcategoryId) return false
    if (filters.amountMin != null && tx.amount < filters.amountMin) return false
    if (filters.amountMax != null && tx.amount > filters.amountMax) return false
    if (filters.query && !movementMatchesText(tx, filters.query)) return false
    return true
  })
}
