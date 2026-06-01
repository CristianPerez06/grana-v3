import { describe, expect, it } from 'vitest'
import { Money } from '@grana/validation'
import {
  splitAmountByPercentages,
  countsByPeriod,
  computeHouseholdBalances,
  pairwiseDebt,
  calculateTransactionSums,
  summarizePeriod,
  type BalanceTransactionRow,
  type DebtMovementSplit,
  type DebtSettlement,
} from '@grana/money-logic'

const A = 'user-a'
const B = 'user-b'

// Convenience builders --------------------------------------------------------

function expenseSplit(
  partial: Partial<DebtMovementSplit> & { memberId: string; movementOwnerId: string },
): DebtMovementSplit {
  return {
    currencyCode: 'ARS',
    movementKind: 'expense',
    amountAssigned: 0,
    counts: true,
    ...partial,
  }
}

// ─── splitAmountByPercentages ────────────────────────────────────────────────

describe('splitAmountByPercentages', () => {
  it('splits an odd amount 50·50 with the parts summing exactly to the total', () => {
    const parts = splitAmountByPercentages('100.01', [50, 50])
    const sum = parts.reduce((acc, m) => Money.add(acc, m), Money.from(0))
    expect(Money.toFixed(sum)).toBe('100.01')
    expect(parts.map((m) => Money.toNumber(m)).sort()).toEqual([50.0, 50.01])
  })

  it('splits 60·40 exactly', () => {
    const parts = splitAmountByPercentages(100, [60, 40]).map((m) => Number(m._d))
    expect(parts).toEqual([60, 40])
  })
})

// ─── countsByPeriod (future-installment gating) ──────────────────────────────

describe('countsByPeriod', () => {
  it('a future installment does not count until its month arrives', () => {
    expect(countsByPeriod('2026-07-10', '2026-06-15')).toBe(false)
  })

  it('an installment due this month counts', () => {
    expect(countsByPeriod('2026-06-30', '2026-06-15')).toBe(true)
  })

  it('a past-due installment counts', () => {
    expect(countsByPeriod('2026-05-01', '2026-06-15')).toBe(true)
  })

  it('a non-installment (null due date) always counts', () => {
    expect(countsByPeriod(null, '2026-06-15')).toBe(true)
  })
})

// ─── computeHouseholdBalances + pairwiseDebt ─────────────────────────────────

describe('computeHouseholdBalances', () => {
  it('derives the debt from a single shared expense (B owes A their share)', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: A, movementOwnerId: A, amountAssigned: 50 }),
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50 }),
    ]
    const balances = computeHouseholdBalances(splits, [], 'ARS')
    expect(balances[A]).toBe(50)
    expect(balances[B]).toBe(-50)
    expect(pairwiseDebt(balances, A, B)).toEqual({ kind: 'owes', from: B, to: A, amount: 50 })
  })

  it('keeps debt separate per currency', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50, currencyCode: 'ARS' }),
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 5, currencyCode: 'USD' }),
    ]
    expect(computeHouseholdBalances(splits, [], 'ARS')[A]).toBe(50)
    expect(computeHouseholdBalances(splits, [], 'USD')[A]).toBe(5)
  })

  it('reports debts under one centavo as settled', () => {
    const balances = { [A]: 0.005, [B]: -0.005 }
    expect(pairwiseDebt(balances, A, B)).toEqual({ kind: 'settled' })
  })

  it('a received reimbursement reduces the debt by the other member share', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50 }),
      // A received a $20 reimbursement on the shared expense → B's share is $10
      { currencyCode: 'ARS', memberId: B, movementOwnerId: A, movementKind: 'reimbursement', amountAssigned: 10, counts: true },
    ]
    const balances = computeHouseholdBalances(splits, [], 'ARS')
    expect(pairwiseDebt(balances, A, B)).toEqual({ kind: 'owes', from: B, to: A, amount: 40 })
  })

  it('a pending reimbursement (counts=false) does not change the debt', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50 }),
      { currencyCode: 'ARS', memberId: B, movementOwnerId: A, movementKind: 'reimbursement', amountAssigned: 10, counts: false },
    ]
    expect(pairwiseDebt(computeHouseholdBalances(splits, [], 'ARS'), A, B)).toEqual({
      kind: 'owes',
      from: B,
      to: A,
      amount: 50,
    })
  })

  it('reduces by the RECEIVED amount when reconciled lower than expected', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50 }),
      // expected $20 → received $18 → B's share is $9
      { currencyCode: 'ARS', memberId: B, movementOwnerId: A, movementKind: 'reimbursement', amountAssigned: 9, counts: true },
    ]
    expect(pairwiseDebt(computeHouseholdBalances(splits, [], 'ARS'), A, B)).toEqual({
      kind: 'owes',
      from: B,
      to: A,
      amount: 41,
    })
  })

  it('a settlement reduces what the payer owed', () => {
    const splits: DebtMovementSplit[] = [
      expenseSplit({ memberId: B, movementOwnerId: A, amountAssigned: 50 }),
    ]
    const settlements: DebtSettlement[] = [
      { currencyCode: 'ARS', payerId: B, receiverId: A, amount: 40, counts: true },
    ]
    const balances = computeHouseholdBalances(splits, settlements, 'ARS')
    expect(pairwiseDebt(balances, A, B)).toEqual({ kind: 'owes', from: B, to: A, amount: 10 })
  })
})

// ─── settlement movement: impacts balance, excluded from analytics ───────────

describe('settlement movement in balance math', () => {
  const settleOut: BalanceTransactionRow = {
    account_id: 'acct-payer',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '14',
    type: 'settlement',
    settlement_direction: 'out',
  }
  const settleIn: BalanceTransactionRow = {
    account_id: 'acct-receiver',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '14',
    type: 'settlement',
    settlement_direction: 'in',
  }

  it("debits the payer's account and credits the receiver's", () => {
    const sums = calculateTransactionSums([settleOut, settleIn], ['acct-payer', 'acct-receiver'])
    expect(sums.get('acct-payer')?.ARS).toBe(-14)
    expect(sums.get('acct-receiver')?.ARS).toBe(14)
  })

  it('is excluded from the period in/out (not a categorized spending/income fact)', () => {
    const income: BalanceTransactionRow = {
      account_id: 'acct-receiver',
      transfer_destination_account_id: null,
      currency_code: 'ARS',
      amount: '100',
      type: 'income',
    }
    const summary = summarizePeriod([income, settleIn], ['acct-receiver'], [])
    expect(summary.ARS.in).toBe(100) // only the income, not the settlement
    expect(summary.ARS.out).toBe(0)
  })
})
