import { describe, it, expect } from 'vitest'
import { computeRunningBalances, type RunningBalanceRow } from '@grana/money-logic'

const row = (over: Partial<RunningBalanceRow> & { id: string }): RunningBalanceRow => ({
  account_id: 'a',
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  amount: 0,
  type: 'income',
  ...over,
})

describe('computeRunningBalances', () => {
  it('accumulates income and expense in order from initial balance', () => {
    const rows = [
      row({ id: 't1', type: 'income', amount: 100 }),
      row({ id: 't2', type: 'expense', amount: 200 }),
    ]
    const snaps = computeRunningBalances(rows, 'a', { ARS: 500, USD: 0 })
    expect(snaps.get('t1')?.ARS).toBe(600)
    expect(snaps.get('t2')?.ARS).toBe(400)
  })

  it('allows negative running balance (never clamped)', () => {
    const rows = [row({ id: 't1', type: 'expense', amount: 200 })]
    const snaps = computeRunningBalances(rows, 'a', { ARS: 0, USD: 0 })
    expect(snaps.get('t1')?.ARS).toBe(-200)
  })

  it('keeps ARS and USD as independent currents', () => {
    const rows = [
      row({ id: 't1', type: 'income', amount: 100, currency_code: 'ARS' }),
      row({ id: 't2', type: 'income', amount: 50, currency_code: 'USD' }),
    ]
    const snaps = computeRunningBalances(rows, 'a', { ARS: 10, USD: 5 })
    expect(snaps.get('t1')).toEqual({ ARS: 110, USD: 5 })
    expect(snaps.get('t2')).toEqual({ ARS: 110, USD: 55 })
  })

  it('handles outgoing and incoming transfers from the account perspective', () => {
    const out = computeRunningBalances(
      [row({ id: 't1', type: 'transfer', amount: 100, account_id: 'a', transfer_destination_account_id: 'b' })],
      'a',
      { ARS: 500, USD: 0 },
    )
    expect(out.get('t1')?.ARS).toBe(400)

    const incoming = computeRunningBalances(
      [row({ id: 't1', type: 'transfer', amount: 100, account_id: 'b', transfer_destination_account_id: 'a' })],
      'a',
      { ARS: 500, USD: 0 },
    )
    expect(incoming.get('t1')?.ARS).toBe(600)
  })

  it('applies an exchange as source outflow and destination inflow in the other currency', () => {
    const rows = [
      row({
        id: 't1',
        type: 'exchange',
        amount: 95000,
        currency_code: 'ARS',
        account_id: 'a',
        transfer_destination_account_id: 'a',
        destination_amount: 100,
        destination_currency: 'USD',
      }),
    ]
    const snaps = computeRunningBalances(rows, 'a', { ARS: 100000, USD: 0 })
    expect(snaps.get('t1')).toEqual({ ARS: 5000, USD: 100 })
  })

  it('applies a signed adjustment', () => {
    const rows = [
      row({ id: 't1', type: 'adjustment', amount: 30 }),
      row({ id: 't2', type: 'adjustment', amount: -50 }),
    ]
    const snaps = computeRunningBalances(rows, 'a', { ARS: 100, USD: 0 })
    expect(snaps.get('t1')?.ARS).toBe(130)
    expect(snaps.get('t2')?.ARS).toBe(80)
  })
})
