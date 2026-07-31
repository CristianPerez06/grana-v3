import { describe, expect, it } from 'vitest'
import { Money } from '@grana/validation'
import {
  splitAmountByPercentages,
  countsByPeriod,
  reimbursementCountsTowardDebt,
  computeHouseholdBalances,
  pairwiseDebt,
  gateSplit,
  householdOutlook,
  calculateTransactionSums,
  summarizePeriod,
  type BalanceTransactionRow,
  type DatedBalanceTransactionRow,
  type DebtMovementSplit,
  type DebtSettlement,
  type ProjectableSplit,
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

// ─── reimbursementCountsTowardDebt (Option B: gate by the linked expense) ────

describe('reimbursementCountsTowardDebt', () => {
  it('does not count while unreceived', () => {
    expect(reimbursementCountsTowardDebt(null, null, null, '2026-06-15')).toBe(false)
  })

  it('does not count when cancelled', () => {
    expect(reimbursementCountsTowardDebt('2026-06-10', '2026-06-12', null, '2026-06-15')).toBe(false)
  })

  it('a received "a cuenta" reimbursement (no due date) counts as soon as received', () => {
    // Real money that already moved → it impacts the balance today, even if the
    // expense it offsets is a card purchase that only settles next month.
    expect(reimbursementCountsTowardDebt('2026-06-10', null, null, '2026-06-15')).toBe(true)
  })

  it('a received "en resumen" reimbursement waits for its statement month', () => {
    expect(reimbursementCountsTowardDebt('2026-06-11', null, '2026-07-10', '2026-06-15')).toBe(false)
    expect(reimbursementCountsTowardDebt('2026-06-11', null, '2026-07-10', '2026-07-01')).toBe(true)
  })
})

// ─── Production case (YPF): impacted reimbursement today, expense projects ────

describe('YPF production case', () => {
  // A (Cristian) pays a $101.994 shared card expense, 50·50, due in July — so
  // Julieta (B)'s $50.997 share is gated to July. A also receives a $15.427 "a
  // cuenta" reimbursement today (June); B's share of it is $7.713. The
  // reimbursement is real money that already moved → it counts today; the card
  // expense lands in July.
  const today = '2026-06-15'
  const expenseDueDate = '2026-07-10'

  const splits = (asOf: string): DebtMovementSplit[] => [
    {
      currencyCode: 'ARS',
      memberId: B,
      movementOwnerId: A,
      movementKind: 'expense',
      amountAssigned: 50.997,
      counts: countsByPeriod(expenseDueDate, asOf),
    },
    {
      currencyCode: 'ARS',
      memberId: B,
      movementOwnerId: A,
      movementKind: 'reimbursement',
      amountAssigned: 7.713,
      counts: reimbursementCountsTowardDebt('2026-06-11', null, null, asOf), // a cuenta
    },
  ]

  it('today (June): only the received reimbursement counts → A owes B $7.713', () => {
    const debt = pairwiseDebt(computeHouseholdBalances(splits(today), [], 'ARS'), A, B)
    expect(debt.kind).toBe('owes')
    if (debt.kind === 'owes') {
      expect(debt.from).toBe(A)
      expect(debt.to).toBe(B)
      expect(debt.amount).toBeCloseTo(7.713, 3)
    }
  })

  it('July: the card expense lands → net B owes A $43.284', () => {
    const debt = pairwiseDebt(computeHouseholdBalances(splits('2026-07-01'), [], 'ARS'), A, B)
    expect(debt.kind).toBe('owes')
    if (debt.kind === 'owes') {
      expect(debt.from).toBe(B)
      expect(debt.to).toBe(A)
      expect(debt.amount).toBeCloseTo(43.284, 3)
    }
  })
})

// ─── Monthly projection (gateSplit + householdOutlook) ───────────────────────

describe('gateSplit', () => {
  const expenseJuly: ProjectableSplit = {
    currencyCode: 'ARS',
    memberId: B,
    movementOwnerId: A,
    movementKind: 'expense',
    amountAssigned: 50,
    gateDueDate: '2026-07-10',
    receivedAt: null,
    cancelledAt: null,
    transactionId: 'tx-ypf',
    label: 'YPF',
    date: '2026-06-15',
  }

  it('a future card expense does not count this month but counts in its month', () => {
    expect(gateSplit(expenseJuly, '2026-06-15').counts).toBe(false)
    expect(gateSplit(expenseJuly, '2026-07-01').counts).toBe(true)
  })

  it('a reimbursement gates on its linked expense date', () => {
    const reimb: ProjectableSplit = {
      ...expenseJuly,
      movementKind: 'reimbursement',
      amountAssigned: 10,
      gateDueDate: '2026-07-10', // linked expense date
      receivedAt: '2026-06-11',
      cancelledAt: null,
    }
    expect(gateSplit(reimb, '2026-06-15').counts).toBe(false)
    expect(gateSplit(reimb, '2026-07-01').counts).toBe(true)
  })
})

describe('householdOutlook', () => {
  const asOfByMonth = [
    { month: '2026-07', asOf: '2026-07-28' },
    { month: '2026-08', asOf: '2026-08-28' },
  ]

  it('a July card expense enters in July (itemised) and stays', () => {
    const splits: ProjectableSplit[] = [
      {
        currencyCode: 'ARS',
        memberId: B,
        movementOwnerId: A,
        movementKind: 'expense',
        amountAssigned: 50,
        gateDueDate: '2026-07-10',
        receivedAt: null,
        cancelledAt: null,
        transactionId: 'tx-ypf',
        label: 'YPF',
        date: '2026-06-15',
      },
    ]
    // baseline today (June): nothing counts → A balance 0.
    const outlook = householdOutlook(splits, [], 'ARS', asOfByMonth, A, 0)
    expect(outlook[0]).toMatchObject({ month: '2026-07', cumulativeForA: 50, deltaForA: 50 })
    expect(outlook[0].items).toEqual([{ transactionId: 'tx-ypf', label: 'YPF', amountForA: 50 }])
    expect(outlook[1]).toMatchObject({ month: '2026-08', cumulativeForA: 50, deltaForA: 0 })
    expect(outlook[1].items).toEqual([])
  })

  it('a reimbursement on the same expense nets out in the expense month', () => {
    const splits: ProjectableSplit[] = [
      {
        currencyCode: 'ARS',
        memberId: B,
        movementOwnerId: A,
        movementKind: 'expense',
        amountAssigned: 50,
        gateDueDate: '2026-07-10',
        receivedAt: null,
        cancelledAt: null,
        transactionId: 'tx-ypf',
        label: 'YPF',
        date: '2026-06-15',
      },
      {
        currencyCode: 'ARS',
        memberId: B,
        movementOwnerId: A,
        movementKind: 'reimbursement',
        amountAssigned: 10,
        gateDueDate: '2026-07-10',
        receivedAt: '2026-06-11',
        cancelledAt: null,
        transactionId: 'tx-ypf-reimb',
        label: 'YPF · Reintegro',
        date: '2026-06-15',
      },
    ]
    const outlook = householdOutlook(splits, [], 'ARS', asOfByMonth, A, 0)
    // July: expense (+50 to A) minus reimbursement's B-share (−10) → A owed 40.
    expect(outlook[0]).toMatchObject({ month: '2026-07', cumulativeForA: 40, deltaForA: 40 })
    expect(outlook[0].items).toHaveLength(2)
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
  const TODAY = '2026-07-31'
  const settleOut: DatedBalanceTransactionRow = {
    date: TODAY,
    account_id: 'acct-payer',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '14',
    type: 'settlement',
    settlement_direction: 'out',
  }
  const settleIn: DatedBalanceTransactionRow = {
    date: TODAY,
    account_id: 'acct-receiver',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '14',
    type: 'settlement',
    settlement_direction: 'in',
  }

  it("debits the payer's account and credits the receiver's", () => {
    const sums = calculateTransactionSums([settleOut, settleIn], ['acct-payer', 'acct-receiver'], TODAY)
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
