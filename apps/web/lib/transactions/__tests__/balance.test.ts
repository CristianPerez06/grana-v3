import { describe, expect, it } from 'vitest'
import { calculateTransactionSums, type DatedBalanceTransactionRow } from '../balance'

const TODAY = '2026-07-31'

describe('calculateTransactionSums', () => {
  it('uses decimal money math for income and expense totals', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({ amount: '0.10', type: 'income' }),
      tx({ amount: '0.20', type: 'income' }),
      tx({ amount: '0.30', type: 'expense' }),
    ]

    expect(calculateTransactionSums(rows, ['account-a'], TODAY).get('account-a')?.ARS).toBe(0)
  })

  it('tracks transfer source and destination without binary float residue', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({
        account_id: 'account-a',
        transfer_destination_account_id: 'account-b',
        amount: '0.10',
        type: 'transfer',
      }),
      tx({
        account_id: 'account-a',
        transfer_destination_account_id: 'account-b',
        amount: '0.20',
        type: 'transfer',
      }),
    ]

    const result = calculateTransactionSums(rows, ['account-a', 'account-b'], TODAY)

    expect(result.get('account-a')?.ARS).toBe(-0.3)
    expect(result.get('account-b')?.ARS).toBe(0.3)
  })

  it('excludes rows dated after todayISO; the boundary day itself counts', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({ amount: '100', type: 'income' }), // dated TODAY → counts (inclusive cut)
      tx({ amount: '40', type: 'expense', date: '2026-08-01' }), // future → out
      tx({ amount: '25', type: 'expense', date: '2026-07-30' }), // past → counts
    ]

    expect(calculateTransactionSums(rows, ['account-a'], TODAY).get('account-a')?.ARS).toBe(75)
  })

  it('keeps signed adjustments in the requested currency', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({ amount: '-0.10', type: 'adjustment', currency_code: 'USD' }),
      tx({ amount: '-0.20', type: 'adjustment', currency_code: 'USD' }),
    ]

    expect(calculateTransactionSums(rows, ['account-a'], TODAY).get('account-a')?.USD).toBe(-0.3)
  })

  it('exchange moves value across currencies between two accounts', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({
        account_id: 'galicia',
        transfer_destination_account_id: 'caja',
        currency_code: 'ARS',
        amount: '150000',
        type: 'exchange',
        destination_currency: 'USD',
        destination_amount: '100',
      }),
    ]

    const result = calculateTransactionSums(rows, ['galicia', 'caja'], TODAY)

    expect(result.get('galicia')?.ARS).toBe(-150000)
    expect(result.get('galicia')?.USD).toBe(0)
    expect(result.get('caja')?.USD).toBe(100)
    expect(result.get('caja')?.ARS).toBe(0)
  })

  it('exchange within the same account moves between its currency buckets', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({
        account_id: 'billetera',
        transfer_destination_account_id: 'billetera',
        currency_code: 'ARS',
        amount: '150000',
        type: 'exchange',
        destination_currency: 'USD',
        destination_amount: '100',
      }),
    ]

    const result = calculateTransactionSums(rows, ['billetera'], TODAY)

    expect(result.get('billetera')?.ARS).toBe(-150000)
    expect(result.get('billetera')?.USD).toBe(100)
  })

  it('exchange uses decimal money math on both legs', () => {
    const rows: DatedBalanceTransactionRow[] = [
      tx({ account_id: 'a', transfer_destination_account_id: 'b', currency_code: 'ARS', amount: '0.30', type: 'exchange', destination_currency: 'USD', destination_amount: '0.10' }),
      tx({ account_id: 'a', transfer_destination_account_id: 'b', currency_code: 'ARS', amount: '0.30', type: 'exchange', destination_currency: 'USD', destination_amount: '0.20' }),
    ]

    const result = calculateTransactionSums(rows, ['a', 'b'], TODAY)

    expect(result.get('a')?.ARS).toBe(-0.6)
    expect(result.get('b')?.USD).toBe(0.3)
  })
})

function tx(overrides: Partial<DatedBalanceTransactionRow>): DatedBalanceTransactionRow {
  return {
    date: TODAY,
    account_id: 'account-a',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '0',
    type: 'income',
    ...overrides,
  }
}
