import { describe, expect, it } from 'vitest'
import {
  monthOf,
  movementMatchesText,
  resolveMonthRange,
  shiftMonth,
} from '../filters'
import type { FinancialMovement } from '../movements'

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
    subcategory_id: null,
    subcategory_name: null,
    destination_account_id: 'account-2',
    destination_account_name: 'Efectivo',
    detail_href: '/accounts/account-1/transactions/tx-1',
    review_flags: [],
    isShared: false,
  }

  it('matches visible functional text case-insensitively', () => {
    expect(movementMatchesText(movement, 'efectivo')).toBe(true)
    expect(movementMatchesText(movement, 'AHORRO')).toBe(true)
    expect(movementMatchesText(movement, 'supermercado')).toBe(false)
  })

  it('treats an empty query as a match (no narrowing)', () => {
    expect(movementMatchesText(movement, '')).toBe(true)
    expect(movementMatchesText(movement, '   ')).toBe(true)
  })
})
