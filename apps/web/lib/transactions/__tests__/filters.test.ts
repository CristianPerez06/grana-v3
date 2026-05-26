import { describe, expect, it } from 'vitest'
import {
  buildFiltersClearedHref,
  buildMovementLimitHref,
  buildSearchClearedHref,
  hasContentFilters,
  hasOtherContentFilters,
  hasSearch,
  monthOf,
  movementMatchesText,
  parseMovementFilters,
  parseMovementLimit,
  resolveEmptyVariant,
  resolveMonthRange,
  shiftMonth,
} from '../filters'
import type { FinancialMovement } from '../movements'

describe('parseMovementFilters', () => {
  it('parses valid URL filters and trims text values', () => {
    const filters = parseMovementFilters({
      q: '  supermercado  ',
      from: '2026-05-01',
      to: '2026-05-31',
      type: 'expense',
      account: 'account-1',
      category: 'category-1',
      currency: 'USD',
      amount_min: '1000',
    })

    expect(filters).toEqual({
      query: 'supermercado',
      from: '2026-05-01',
      to: '2026-05-31',
      type: 'expense',
      accountId: 'account-1',
      categoryId: 'category-1',
      currency: 'USD',
      amountMin: 1000,
    })
  })

  it('reads an explicit month and derives its range', () => {
    const filters = parseMovementFilters({ month: '2026-03' })
    expect(filters).toEqual({ month: '2026-03', from: '2026-03-01', to: '2026-03-31' })
  })

  it('ignores malformed values and defaults to the current month', () => {
    const filters = parseMovementFilters({
      from: '05/01/2026',
      to: 'tomorrow',
      type: 'unknown',
      currency: 'EUR',
    })

    expect(filters.type).toBeUndefined()
    expect(filters.currency).toBeUndefined()
    expect(filters.month).toMatch(/^\d{4}-\d{2}$/)
    expect(filters).toMatchObject(resolveMonthRange(filters.month!))
  })

  it('accepts explicit date bounds without a preset period', () => {
    const filters = parseMovementFilters({
      from: '2026-05-01',
      to: '2026-05-31',
    })

    expect(filters).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })
})

describe('parseMovementLimit', () => {
  it('uses the default page size when the URL has no limit', () => {
    expect(parseMovementLimit({})).toBe(50)
  })

  it('accepts valid limits and clamps excessive values', () => {
    expect(parseMovementLimit({ limit: '150' })).toBe(150)
    expect(parseMovementLimit({ limit: '9999' })).toBe(500)
  })

  it('ignores malformed or too-small limits', () => {
    expect(parseMovementLimit({ limit: 'abc' })).toBe(50)
    expect(parseMovementLimit({ limit: '10' })).toBe(50)
  })
})

describe('buildMovementLimitHref', () => {
  it('preserves movement filters and updates the limit', () => {
    const href = buildMovementLimitHref({
      q: 'super',
      type: 'expense',
      category: 'category-1',
      limit: '50',
    }, 100)

    expect(href).toBe('/transactions?q=super&type=expense&category=category-1&limit=100')
  })
})

describe('resolveMonthRange', () => {
  it('returns the first and last accounting date of a month', () => {
    expect(resolveMonthRange('2026-05')).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('handles February', () => {
    expect(resolveMonthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

describe('shiftMonth', () => {
  it('navigates to the previous and next month', () => {
    expect(shiftMonth('2026-05', -1)).toBe('2026-04')
    expect(shiftMonth('2026-05', 1)).toBe('2026-06')
  })

  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('monthOf', () => {
  it('formats a date as YYYY-MM', () => {
    expect(monthOf(new Date(2026, 4, 18))).toBe('2026-05')
    expect(monthOf(new Date(2026, 0, 1))).toBe('2026-01')
  })
})

describe('hasContentFilters', () => {
  it('is true for content filters (type, category, query, amount)', () => {
    expect(hasContentFilters({ type: 'expense' })).toBe(true)
    expect(hasContentFilters({ categoryId: 'c1' })).toBe(true)
    expect(hasContentFilters({ query: 'coto' })).toBe(true)
    expect(hasContentFilters({ amountMin: 1000 })).toBe(true)
  })

  it('is false for month navigation and currency (not content filters)', () => {
    expect(hasContentFilters({ month: '2026-05' })).toBe(false)
    expect(hasContentFilters({ currency: 'USD' })).toBe(false)
    expect(hasContentFilters({ from: '2026-05-01', to: '2026-05-31' })).toBe(false)
    expect(hasContentFilters({})).toBe(false)
  })
})

describe('movementMatchesText', () => {
  const movement: FinancialMovement = {
    id: 'tx-1',
    kind: 'transfer',
    title: 'Transferencia',
    sign: null,
    date: '2026-05-18',
    created_at: '2026-05-18T12:00:00.000Z',
    amount: 100,
    currency_code: 'ARS',
    description: 'Ahorro mensual',
    account_id: 'account-1',
    account_name: 'Galicia',
    category_id: null,
    category_name: null,
    category_icon: null,
    category_color: null,
    destination_account_id: 'account-2',
    destination_account_name: 'Efectivo',
    detail_href: '/accounts/account-1/transactions/tx-1',
    review_flags: [],
  }

  it('matches visible functional text case-insensitively', () => {
    expect(movementMatchesText(movement, 'efectivo')).toBe(true)
    expect(movementMatchesText(movement, 'AHORRO')).toBe(true)
    expect(movementMatchesText(movement, 'supermercado')).toBe(false)
  })
})

describe('resolveEmptyVariant', () => {
  it('none: no search and no content filters (month alone does not count)', () => {
    expect(resolveEmptyVariant({})).toBe('none')
    expect(resolveEmptyVariant({ month: '2026-05', from: '2026-05-01', to: '2026-05-31' })).toBe('none')
  })

  it('search: only a text query is active', () => {
    expect(resolveEmptyVariant({ query: 'uber' })).toBe('search')
    expect(hasSearch({ query: 'uber' })).toBe(true)
  })

  it('filter: any of type/category/account/currency/amount range', () => {
    expect(resolveEmptyVariant({ type: 'expense' })).toBe('filter')
    expect(resolveEmptyVariant({ categoryId: 'c1' })).toBe('filter')
    expect(resolveEmptyVariant({ accountId: 'a1' })).toBe('filter')
    expect(resolveEmptyVariant({ currency: 'USD' })).toBe('filter')
    expect(resolveEmptyVariant({ amountMin: 100 })).toBe('filter')
    expect(resolveEmptyVariant({ amountMax: 100 })).toBe('filter')
  })

  it('currency counts for the empty variant (unlike hasContentFilters)', () => {
    expect(hasOtherContentFilters({ currency: 'USD' })).toBe(true)
    expect(hasContentFilters({ currency: 'USD' })).toBe(false)
  })

  it('precedence filter > search when both are active', () => {
    expect(resolveEmptyVariant({ query: 'uber', type: 'expense' })).toBe('filter')
  })
})

describe('buildFiltersClearedHref / buildSearchClearedHref', () => {
  const params = {
    q: 'uber',
    month: '2026-05',
    type: 'expense',
    category: 'c1',
    account: 'a1',
    currency: 'USD',
    amount_min: '100',
    amount_max: '500',
    limit: '150',
  }

  it('clear filters: keeps q + month, drops content filters and limit', () => {
    const href = buildFiltersClearedHref('/transactions', params)
    expect(href).toContain('q=uber')
    expect(href).toContain('month=2026-05')
    expect(href).not.toContain('type=')
    expect(href).not.toContain('category=')
    expect(href).not.toContain('account=')
    expect(href).not.toContain('currency=')
    expect(href).not.toContain('amount_min=')
    expect(href).not.toContain('amount_max=')
    expect(href).not.toContain('limit=')
  })

  it('clear search: drops only q, keeps the filters and month', () => {
    const href = buildSearchClearedHref('/transactions', params)
    expect(href).not.toContain('q=')
    expect(href).toContain('type=expense')
    expect(href).toContain('month=2026-05')
  })

  it('respects the base path (account view)', () => {
    expect(buildFiltersClearedHref('/accounts/a1', params).startsWith('/accounts/a1?')).toBe(true)
  })

  it('returns the bare base path when nothing remains', () => {
    expect(buildFiltersClearedHref('/transactions', { type: 'expense' })).toBe('/transactions')
  })
})
