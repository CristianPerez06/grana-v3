import { describe, expect, it } from 'vitest'
import {
  buildMovementLimitHref,
  movementMatchesText,
  parseMovementFilters,
  parseMovementLimit,
  resolveMovementPeriod,
} from '../filters'
import type { FinancialMovement } from '../movements'

describe('parseMovementFilters', () => {
  it('parses valid URL filters and trims text values', () => {
    const filters = parseMovementFilters({
      q: '  supermercado  ',
      period: 'custom',
      from: '2026-05-01',
      to: '2026-05-31',
      type: 'expense',
      account: 'account-1',
      category: 'category-1',
    })

    expect(filters).toEqual({
      query: 'supermercado',
      period: 'custom',
      from: '2026-05-01',
      to: '2026-05-31',
      type: 'expense',
      accountId: 'account-1',
      categoryId: 'category-1',
    })
  })

  it('ignores malformed enum values and dates', () => {
    const filters = parseMovementFilters({
      period: 'all-time',
      from: '05/01/2026',
      to: 'tomorrow',
      type: 'unknown',
    })

    expect(filters).toEqual({})
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

describe('resolveMovementPeriod', () => {
  const today = new Date(2026, 4, 18)

  it('resolves current month using financial dates', () => {
    expect(resolveMovementPeriod('current_month', today)).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })

  it('resolves previous month across year boundaries', () => {
    expect(resolveMovementPeriod('previous_month', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('resolves current year', () => {
    expect(resolveMovementPeriod('current_year', today)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
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
