import { describe, expect, it } from 'vitest'
import { calculateTransactionSums, type BalanceTransactionRow } from '../balance'

describe('calculateTransactionSums', () => {
  it('uses decimal money math for income and expense totals', () => {
    const rows: BalanceTransactionRow[] = [
      tx({ amount: '0.10', type: 'income' }),
      tx({ amount: '0.20', type: 'income' }),
      tx({ amount: '0.30', type: 'expense' }),
    ]

    expect(calculateTransactionSums(rows, ['account-a']).get('account-a')?.ARS).toBe(0)
  })

  it('tracks transfer source and destination without binary float residue', () => {
    const rows: BalanceTransactionRow[] = [
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

    const result = calculateTransactionSums(rows, ['account-a', 'account-b'])

    expect(result.get('account-a')?.ARS).toBe(-0.3)
    expect(result.get('account-b')?.ARS).toBe(0.3)
  })

  it('keeps signed adjustments in the requested currency', () => {
    const rows: BalanceTransactionRow[] = [
      tx({ amount: '-0.10', type: 'adjustment', currency_code: 'USD' }),
      tx({ amount: '-0.20', type: 'adjustment', currency_code: 'USD' }),
    ]

    expect(calculateTransactionSums(rows, ['account-a']).get('account-a')?.USD).toBe(-0.3)
  })

  it('exchange moves value across currencies between two accounts', () => {
    const rows: BalanceTransactionRow[] = [
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

    const result = calculateTransactionSums(rows, ['galicia', 'caja'])

    expect(result.get('galicia')?.ARS).toBe(-150000)
    expect(result.get('galicia')?.USD).toBe(0)
    expect(result.get('caja')?.USD).toBe(100)
    expect(result.get('caja')?.ARS).toBe(0)
  })

  it('exchange within the same account moves between its currency buckets', () => {
    const rows: BalanceTransactionRow[] = [
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

    const result = calculateTransactionSums(rows, ['billetera'])

    expect(result.get('billetera')?.ARS).toBe(-150000)
    expect(result.get('billetera')?.USD).toBe(100)
  })

  it('exchange uses decimal money math on both legs', () => {
    const rows: BalanceTransactionRow[] = [
      tx({ account_id: 'a', transfer_destination_account_id: 'b', currency_code: 'ARS', amount: '0.30', type: 'exchange', destination_currency: 'USD', destination_amount: '0.10' }),
      tx({ account_id: 'a', transfer_destination_account_id: 'b', currency_code: 'ARS', amount: '0.30', type: 'exchange', destination_currency: 'USD', destination_amount: '0.20' }),
    ]

    const result = calculateTransactionSums(rows, ['a', 'b'])

    expect(result.get('a')?.ARS).toBe(-0.6)
    expect(result.get('b')?.USD).toBe(0.3)
  })
})

function tx(overrides: Partial<BalanceTransactionRow>): BalanceTransactionRow {
  return {
    account_id: 'account-a',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '0',
    type: 'income',
    ...overrides,
  }
}
