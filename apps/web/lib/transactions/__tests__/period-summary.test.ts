import { describe, it, expect } from 'vitest'
import { summarizePeriod, type BalanceTransactionRow } from '@grana/money-logic'

const row = (over: Partial<BalanceTransactionRow>): BalanceTransactionRow => ({
  account_id: 'cash',
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  amount: 0,
  type: 'income',
  ...over,
})

describe('summarizePeriod', () => {
  it('separates ARS and USD; never merges currencies', () => {
    const rows = [
      row({ type: 'income', amount: 850000, currency_code: 'ARS' }),
      row({ type: 'income', amount: 500, currency_code: 'USD' }),
      row({ type: 'expense', amount: 12500, currency_code: 'ARS' }),
    ]
    const s = summarizePeriod(rows, ['cash'], [])
    expect(s.ARS).toEqual({ in: 850000, out: 12500, committed: 0 })
    expect(s.USD).toEqual({ in: 500, out: 0, committed: 0 })
  })

  it('excludes transfer and exchange from out (neither is an expense)', () => {
    const rows = [
      row({ type: 'expense', amount: 100, account_id: 'cash' }),
      row({ type: 'transfer', amount: 20000, account_id: 'cash', transfer_destination_account_id: 'savings' }),
      row({ type: 'exchange', amount: 95000, account_id: 'cash', transfer_destination_account_id: 'cash' }),
    ]
    const s = summarizePeriod(rows, ['cash'], [])
    expect(s.ARS.out).toBe(100)
  })

  it('splits adjustments by sign', () => {
    const rows = [
      row({ type: 'adjustment', amount: 30 }),
      row({ type: 'adjustment', amount: -50 }),
    ]
    const s = summarizePeriod(rows, ['cash'], [])
    expect(s.ARS.in).toBe(30)
    expect(s.ARS.out).toBe(50)
  })

  it('only owned accounts count toward in/out (card spend excluded)', () => {
    const rows = [
      row({ type: 'expense', amount: 100, account_id: 'cash' }),
      row({ type: 'expense', amount: 45000, account_id: 'card' }), // not in owned ids
    ]
    const s = summarizePeriod(rows, ['cash'], [])
    expect(s.ARS.out).toBe(100)
  })

  it('sums committed installments per currency, separate from out', () => {
    const committed = [
      { currency_code: 'ARS', amount: 10000 },
      { currency_code: 'ARS', amount: 5000 },
      { currency_code: 'USD', amount: 20 },
    ]
    const s = summarizePeriod([], ['cash'], committed)
    expect(s.ARS.committed).toBe(15000)
    expect(s.USD.committed).toBe(20)
    expect(s.ARS.out).toBe(0)
  })

  it('applies the same rule as the dashboard: income in, expense+|neg adj| out, transfer skipped', () => {
    // Same rule as @grana/dashboard buildMonthBalanceSeries (income → in,
    // expense and negative adjustment → out, transfer skipped) so both screens
    // show identical numbers for the same rows.
    const rows: BalanceTransactionRow[] = [
      row({ type: 'income', amount: 850000 }),
      row({ type: 'expense', amount: 12500 }),
      row({ type: 'adjustment', amount: -3000 }),
      row({ type: 'transfer', amount: 20000, transfer_destination_account_id: 'savings' }),
    ]
    const s = summarizePeriod(rows, ['cash'], [])
    expect(s.ARS.in).toBe(850000)
    expect(s.ARS.out).toBe(15500) // 12500 expense + 3000 negative adjustment; transfer skipped
  })
})
