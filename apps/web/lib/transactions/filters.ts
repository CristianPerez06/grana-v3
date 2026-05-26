import { formatDateISO, getTodayAR } from '@/lib/date'
import type { FinancialMovement } from './movements'

export type MovementTypeFilter = FinancialMovement['kind']
export type MovementCurrencyFilter = 'ARS' | 'USD'

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
  currency?: MovementCurrencyFilter
  amountMin?: number
  amountMax?: number
}

type SearchParamValue = string | string[] | undefined
type SearchParamsLike = Record<string, SearchParamValue> | URLSearchParams

export const DEFAULT_MOVEMENTS_LIMIT = 50
export const MOVEMENTS_LIMIT_STEP = 50
export const MAX_MOVEMENTS_LIMIT = 500

export const MOVEMENT_TYPE_KEYS: ReadonlyArray<MovementTypeFilter> = [
  'income',
  'expense',
  'card_payment',
  'transfer',
  'exchange',
  'adjustment',
  'installment_purchase',
]

const VALID_MOVEMENT_TYPES = new Set<string>(MOVEMENT_TYPE_KEYS)

const getParam = (params: SearchParamsLike, key: string) => {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isMonth = (value: string): boolean => /^\d{4}-\d{2}$/.test(value)

/** `YYYY-MM` of a date. */
export const monthOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** First/last accounting date of a `YYYY-MM` month. */
export const resolveMonthRange = (month: string): Pick<MovementFilters, 'from' | 'to'> => {
  const [year, m] = month.split('-').map(Number)
  const from = formatDateISO(new Date(year, m - 1, 1))
  const to = formatDateISO(new Date(year, m, 0))
  return { from, to }
}

/** Shift a `YYYY-MM` month by `delta` months. */
export const shiftMonth = (month: string, delta: number): string => {
  const [year, m] = month.split('-').map(Number)
  return monthOf(new Date(year, m - 1 + delta, 1))
}

/**
 * Content filters narrow WHICH movements show (skipping rows), so a per-row
 * running balance would be misleading and must hide. Month navigation and the
 * currency filter are NOT content filters: the month shows a consecutive slice,
 * and currency only narrows a dimension the balance already keeps separate.
 */
export const hasContentFilters = (filters: MovementFilters): boolean =>
  Boolean(filters.query || filters.type || filters.categoryId) ||
  filters.amountMin != null ||
  filters.amountMax != null

export const parseMovementFilters = (params: SearchParamsLike): MovementFilters => {
  const filters: MovementFilters = {}

  const query = getParam(params, 'q')?.trim()
  if (query) filters.query = query

  // Period: a custom from/to range takes priority; otherwise the selected month;
  // otherwise the current month (financial timezone).
  const from = getParam(params, 'from')
  const to = getParam(params, 'to')
  const hasCustomRange = (from && isIsoDate(from)) || (to && isIsoDate(to))

  if (hasCustomRange) {
    if (from && isIsoDate(from)) filters.from = from
    if (to && isIsoDate(to)) filters.to = to
  } else {
    const rawMonth = getParam(params, 'month')
    const month = rawMonth && isMonth(rawMonth) ? rawMonth : monthOf(getTodayAR())
    filters.month = month
    Object.assign(filters, resolveMonthRange(month))
  }

  const rawType = getParam(params, 'type')
  if (rawType && VALID_MOVEMENT_TYPES.has(rawType)) {
    filters.type = rawType as MovementTypeFilter
  }

  const accountId = getParam(params, 'account')?.trim()
  if (accountId) filters.accountId = accountId

  const categoryId = getParam(params, 'category')?.trim()
  if (categoryId) filters.categoryId = categoryId

  const currency = getParam(params, 'currency')
  if (currency === 'ARS' || currency === 'USD') filters.currency = currency

  const amountMin = Number(getParam(params, 'amount_min'))
  if (Number.isFinite(amountMin) && amountMin > 0) filters.amountMin = amountMin

  const amountMax = Number(getParam(params, 'amount_max'))
  if (Number.isFinite(amountMax) && amountMax > 0) filters.amountMax = amountMax

  return filters
}

export const parseMovementLimit = (params: SearchParamsLike): number => {
  const rawLimit = getParam(params, 'limit')
  if (!rawLimit) return DEFAULT_MOVEMENTS_LIMIT

  const parsed = Number(rawLimit)
  if (!Number.isInteger(parsed) || parsed < DEFAULT_MOVEMENTS_LIMIT) {
    return DEFAULT_MOVEMENTS_LIMIT
  }

  return Math.min(parsed, MAX_MOVEMENTS_LIMIT)
}

const FILTER_PARAM_KEYS = [
  'q',
  'month',
  'from',
  'to',
  'type',
  'account',
  'category',
  'currency',
  'amount_min',
  'amount_max',
]

export const buildMovementLimitHref = (
  params: SearchParamsLike,
  nextLimit: number,
): string => {
  const searchParams = new URLSearchParams()

  for (const key of FILTER_PARAM_KEYS) {
    const value = getParam(params, key)
    if (value) searchParams.set(key, value)
  }

  searchParams.set('limit', String(Math.min(nextLimit, MAX_MOVEMENTS_LIMIT)))

  return `/transactions?${searchParams.toString()}`
}

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
