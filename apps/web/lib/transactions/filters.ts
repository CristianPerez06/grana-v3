import { formatDateISO, getTodayAR } from '@/lib/date'
import type { FinancialMovement } from './movements'

export type MovementTypeFilter = FinancialMovement['kind']

export type MovementPeriodFilter =
  | 'current_month'
  | 'previous_month'
  | 'current_year'
  | 'custom'

export type MovementFilters = {
  query?: string
  period?: MovementPeriodFilter
  from?: string
  to?: string
  type?: MovementTypeFilter
  accountId?: string
  categoryId?: string
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

export const MOVEMENT_PERIOD_KEYS: ReadonlyArray<MovementPeriodFilter> = [
  'current_month',
  'previous_month',
  'current_year',
  'custom',
]

const VALID_MOVEMENT_TYPES = new Set<string>(MOVEMENT_TYPE_KEYS)
const VALID_PERIODS = new Set<string>(MOVEMENT_PERIOD_KEYS)

const getParam = (params: SearchParamsLike, key: string) => {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

const firstDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const lastDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0)

export const resolveMovementPeriod = (
  period: MovementPeriodFilter,
  today: Date = getTodayAR(),
): Pick<MovementFilters, 'from' | 'to'> => {
  if (period === 'current_month') {
    return {
      from: formatDateISO(firstDayOfMonth(today)),
      to: formatDateISO(lastDayOfMonth(today)),
    }
  }

  if (period === 'previous_month') {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return {
      from: formatDateISO(firstDayOfMonth(previousMonth)),
      to: formatDateISO(lastDayOfMonth(previousMonth)),
    }
  }

  if (period === 'current_year') {
    const year = today.getFullYear()
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }

  return {}
}

export const parseMovementFilters = (params: SearchParamsLike): MovementFilters => {
  const filters: MovementFilters = {}

  const query = getParam(params, 'q')?.trim()
  if (query) filters.query = query

  const rawPeriod = getParam(params, 'period')
  if (rawPeriod && VALID_PERIODS.has(rawPeriod)) {
    filters.period = rawPeriod as MovementPeriodFilter

    if (filters.period === 'custom') {
      const from = getParam(params, 'from')
      const to = getParam(params, 'to')

      if (from && isIsoDate(from)) filters.from = from
      if (to && isIsoDate(to)) filters.to = to
    } else {
      Object.assign(filters, resolveMovementPeriod(filters.period))
    }
  } else {
    const from = getParam(params, 'from')
    const to = getParam(params, 'to')

    if (from && isIsoDate(from)) filters.from = from
    if (to && isIsoDate(to)) filters.to = to
  }

  const rawType = getParam(params, 'type')
  if (rawType && VALID_MOVEMENT_TYPES.has(rawType)) {
    filters.type = rawType as MovementTypeFilter
  }

  const accountId = getParam(params, 'account')?.trim()
  if (accountId) filters.accountId = accountId

  const categoryId = getParam(params, 'category')?.trim()
  if (categoryId) filters.categoryId = categoryId

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

export const buildMovementLimitHref = (
  params: SearchParamsLike,
  nextLimit: number,
): string => {
  const searchParams = new URLSearchParams()

  const keys = ['q', 'period', 'from', 'to', 'type', 'account', 'category']
  for (const key of keys) {
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
