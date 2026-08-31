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
    account_name: 'Sueldo',
    account_institution_name: 'Galicia',
    category_id: null,
    category_name: null,
    category_icon: null,
    category_color: null,
    category_canonical_name: null,
    category_is_system: false,
    subcategory_id: null,
    subcategory_name: null,
    subcategory_canonical_name: null,
    subcategory_is_system: false,
    destination_account_id: 'account-2',
    destination_account_name: 'Caja de ahorro',
    destination_account_institution_name: 'Santander',
    detail_href: '/accounts/account-1/transactions/tx-1',
    review_flags: [],
    isShared: false,
  }

  // A currency exchange shows BOTH ends on the row exactly like a transfer does,
  // so both ends have to be searchable. The old matcher gated the destination
  // behind `kind === 'transfer'`, which left this one unreachable.
  const exchange: FinancialMovement = {
    ...movement,
    id: 'tx-2',
    kind: 'exchange',
    title: 'Cambio',
    sign: '-',
    description: null,
    destination_amount: 100,
    destination_currency: 'USD',
  }

  // The case the whole change is about: no description at all. Everything the
  // row shows comes from elsewhere — the title (which for an expense IS the
  // category name), the account, the institution.
  const uncategorizedExpense: FinancialMovement = {
    id: 'tx-3',
    kind: 'expense',
    title: 'Supermercado',
    sign: '-',
    date: '2026-05-18',
    created_at: '2026-05-18T12:00:00.000Z',
    amount: 4500,
    currency_code: 'ARS',
    description: null,
    account_id: 'account-1',
    account_name: 'Cuenta corriente',
    account_institution_name: 'Galicia',
    category_id: 'cat-1',
    category_name: 'Supermercado',
    category_icon: null,
    category_color: null,
    category_canonical_name: 'supermarket',
    category_is_system: true,
    subcategory_id: 'sub-1',
    subcategory_name: 'Verdulería',
    subcategory_canonical_name: 'greengrocer',
    subcategory_is_system: true,
    detail_href: '/accounts/account-1/transactions/tx-3',
    review_flags: [],
    isShared: false,
  }

  it('matches visible functional text case-insensitively', () => {
    expect(movementMatchesText(movement, 'transferencia')).toBe(true)
    expect(movementMatchesText(movement, 'AHORRO')).toBe(true)
    expect(movementMatchesText(movement, 'supermercado')).toBe(false)
  })

  it('treats an empty query as a match (no narrowing)', () => {
    expect(movementMatchesText(movement, '')).toBe(true)
    expect(movementMatchesText(movement, '   ')).toBe(true)
  })

  it('matches the source and destination account names', () => {
    expect(movementMatchesText(movement, 'Sueldo')).toBe(true)
    expect(movementMatchesText(movement, 'Caja de ahorro')).toBe(true)
  })

  it('matches the institution of both accounts — the row headline', () => {
    expect(movementMatchesText(movement, 'Galicia')).toBe(true)
    expect(movementMatchesText(movement, 'santander')).toBe(true)
  })

  it('matches both ends of an exchange, not just a transfer', () => {
    expect(movementMatchesText(exchange, 'Caja de ahorro')).toBe(true)
    expect(movementMatchesText(exchange, 'Santander')).toBe(true)
    expect(movementMatchesText(exchange, 'Galicia')).toBe(true)
  })

  it('finds a movement with no description by its title, account or institution', () => {
    expect(movementMatchesText(uncategorizedExpense, 'Supermercado')).toBe(true)
    expect(movementMatchesText(uncategorizedExpense, 'cuenta corriente')).toBe(true)
    expect(movementMatchesText(uncategorizedExpense, 'galicia')).toBe(true)
  })

  // The lower edge of the set. Without these, a future change that widens the
  // haystack back out passes the whole suite unnoticed — and the point of the
  // set is as much what it excludes as what it includes.
  it('does NOT match the subcategory name — that axis has its own filter', () => {
    expect(movementMatchesText(uncategorizedExpense, 'Verdulería')).toBe(false)
  })

  it('does NOT match a canonical_name — an internal slug, not visible text', () => {
    expect(movementMatchesText(uncategorizedExpense, 'supermarket')).toBe(false)
    expect(movementMatchesText(uncategorizedExpense, 'greengrocer')).toBe(false)
  })

  it('does NOT match the category name when it is not the title', () => {
    // A transfer's title is the fixed label, so its category (none here, but the
    // rule holds for any kind whose title is fixed) is not part of the haystack.
    const categorizedTransfer: FinancialMovement = {
      ...movement,
      category_id: 'cat-1',
      category_name: 'Supermercado',
      category_canonical_name: 'supermarket',
      category_is_system: true,
    }
    expect(movementMatchesText(categorizedTransfer, 'Supermercado')).toBe(false)
  })
})
