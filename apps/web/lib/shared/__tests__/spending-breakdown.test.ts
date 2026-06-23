import { describe, expect, it } from 'vitest'
import {
  groupSharedSpendingByCategory,
  sharedOwnNetShare,
  sharedReimbursementsTotal,
  sharedSpendingTotal,
} from '../spending-breakdown'
import type { SharedExpenseItem } from '../types'

// Minimal factory — only the fields the breakdown reads.
const item = (over: Partial<SharedExpenseItem>): SharedExpenseItem => ({
  id: Math.random().toString(36).slice(2),
  kind: 'expense',
  reimbursementState: null,
  description: null,
  categoryId: 'cat-a',
  categoryName: 'Supermercado',
  categoryCanonicalName: 'supermarket',
  categoryIsSystem: true,
  categoryColor: '#111',
  categoryIcon: null,
  subcategoryName: null,
  subcategoryCanonicalName: null,
  subcategoryIsSystem: false,
  date: '2026-06-10',
  dueDate: null,
  amount: 100,
  currencyCode: 'ARS',
  payerId: 'u1',
  payerName: 'Juli',
  ownShare: 50,
  isInstallment: false,
  ...over,
})

describe('sharedSpendingTotal', () => {
  it('sums the household TOTAL (amount, both parts), not the own share', () => {
    const items = [
      item({ amount: 100, ownShare: 50 }),
      item({ amount: 40, ownShare: 10 }),
    ]
    // total = 140 (amounts), NOT 60 (own shares)
    expect(sharedSpendingTotal(items, 'ARS')).toBe(140)
  })

  it('separates currencies (never merges ARS and USD)', () => {
    const items = [
      item({ amount: 100, currencyCode: 'ARS' }),
      item({ amount: 7, currencyCode: 'USD' }),
    ]
    expect(sharedSpendingTotal(items, 'ARS')).toBe(100)
    expect(sharedSpendingTotal(items, 'USD')).toBe(7)
  })

  it('ignores reimbursements (gross spending)', () => {
    const items = [
      item({ amount: 100, kind: 'expense' }),
      item({ amount: 30, kind: 'reimbursement' }),
    ]
    expect(sharedSpendingTotal(items, 'ARS')).toBe(100)
  })
})

describe('net helpers (gross − reimbursements)', () => {
  const items = [
    item({ kind: 'expense', amount: 145800, ownShare: 72900 }),
    item({ kind: 'reimbursement', amount: 15427, ownShare: 7713 }),
  ]

  it('sharedReimbursementsTotal sums received reimbursements (household total)', () => {
    expect(sharedReimbursementsTotal(items, 'ARS')).toBe(15427)
  })

  it('net = gross − reimbursements', () => {
    expect(sharedSpendingTotal(items, 'ARS') - sharedReimbursementsTotal(items, 'ARS')).toBe(130373)
  })

  it('sharedOwnNetShare = own expense shares − own reimbursement shares', () => {
    expect(sharedOwnNetShare(items, 'ARS')).toBe(72900 - 7713)
  })

  it('own net share separates currencies', () => {
    const mixed = [
      item({ kind: 'expense', amount: 100, ownShare: 50, currencyCode: 'ARS' }),
      item({ kind: 'expense', amount: 9, ownShare: 4.5, currencyCode: 'USD' }),
    ]
    expect(sharedOwnNetShare(mixed, 'USD')).toBe(4.5)
  })
})

describe('groupSharedSpendingByCategory', () => {
  it('groups by category summing the household total, sorted desc', () => {
    const groups = groupSharedSpendingByCategory(
      [
        item({ categoryId: 'cat-a', amount: 100 }),
        item({ categoryId: 'cat-b', amount: 250, categoryName: 'Transporte' }),
        item({ categoryId: 'cat-a', amount: 50 }),
      ],
      'ARS',
    )
    expect(groups.map((g) => [g.categoryId, g.value])).toEqual([
      ['cat-b', 250],
      ['cat-a', 150],
    ])
  })

  it('only counts the requested currency', () => {
    const groups = groupSharedSpendingByCategory(
      [
        item({ categoryId: 'cat-a', amount: 100, currencyCode: 'ARS' }),
        item({ categoryId: 'cat-a', amount: 9, currencyCode: 'USD' }),
      ],
      'USD',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].value).toBe(9)
  })

  it('buckets items without category under a null categoryId', () => {
    const groups = groupSharedSpendingByCategory(
      [item({ categoryId: null, categoryName: null, amount: 80 })],
      'ARS',
    )
    expect(groups[0].categoryId).toBeNull()
    expect(groups[0].value).toBe(80)
  })

  it('excludes reimbursements from the breakdown', () => {
    const groups = groupSharedSpendingByCategory(
      [
        item({ categoryId: 'cat-a', amount: 100, kind: 'expense' }),
        item({ categoryId: 'cat-a', amount: 40, kind: 'reimbursement' }),
      ],
      'ARS',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].value).toBe(100)
  })
})
