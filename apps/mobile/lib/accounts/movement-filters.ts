import { resolveMonthRange } from '@grana/dashboard'
import { getTodayAR } from '@grana/money-logic'
import type { TransactionType, TransactionWithDetails } from '@grana/transactions'
import type { Locale } from '../locale'

// Account-detail movements filter state. Native analogue of web's
// `TransactionsFilters`, trimmed to what the account detail uses: month
// navigation + content filters + free-text search. No customRange (mobile
// navigates by month only) and no view-pref fields.
export type AccountMovementFilters = {
  month: string // YYYY-MM
  type: TransactionType | null
  categoryId: string | null
  subcategoryId: string | null
  currency: 'ARS' | 'USD' | null
  amountMin: number | null
  amountMax: number | null
  query: string
}

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

export function emptyFilters(month: string): AccountMovementFilters {
  return {
    month,
    type: null,
    categoryId: null,
    subcategoryId: null,
    currency: null,
    amountMin: null,
    amountMax: null,
    query: '',
  }
}

// ── Matching + application ───────────────────────────────────────────────────────

// Free-text match over description, category name/canonical and the source /
// destination account names. Native analogue of web's `movementMatchesText`.
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
export function applyAccountFilters(
  movements: TransactionWithDetails[],
  filters: AccountMovementFilters,
): TransactionWithDetails[] {
  const { from, to } = resolveMonthRange(filters.month)
  return movements.filter((tx) => {
    if (tx.date < from || tx.date > to) return false
    if (filters.type && tx.type !== filters.type) return false
    if (filters.currency && tx.currency_code !== filters.currency) return false
    if (filters.categoryId && tx.category_id !== filters.categoryId) return false
    if (filters.subcategoryId && tx.subcategory_id !== filters.subcategoryId) return false
    if (filters.amountMin != null && tx.amount < filters.amountMin) return false
    if (filters.amountMax != null && tx.amount > filters.amountMax) return false
    if (filters.query && !movementMatchesText(tx, filters.query)) return false
    return true
  })
}

// Active content-filter count for the "Filtros" badge — excludes `month` and
// `query` (those have their own controls), mirror of web.
export function activeFilterCount(filters: AccountMovementFilters): number {
  let n = 0
  if (filters.type) n++
  if (filters.categoryId) n++
  if (filters.subcategoryId) n++
  if (filters.currency) n++
  if (filters.amountMin != null) n++
  if (filters.amountMax != null) n++
  return n
}
