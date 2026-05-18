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
