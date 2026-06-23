import { describe, expect, it } from 'vitest'
import {
  deriveCurrentAccount,
  householdDebtAt,
  type DebtSettlement,
  type LedgerSettlement,
  type ProjectableSplit,
} from '@grana/money-logic'

const A = 'user-a'
const B = 'user-b'

// One shared expense (50·50) → two splits; only the non-payer's split creates debt.
const expense = (
  id: string,
  payer: string,
  shareEach: number,
  date: string,
  over: Partial<ProjectableSplit> = {},
): ProjectableSplit[] =>
  [A, B].map((memberId) => ({
    currencyCode: 'ARS',
    memberId,
    movementOwnerId: payer,
    movementKind: 'expense',
    amountAssigned: shareEach,
    gateDueDate: null,
    receivedAt: null,
    cancelledAt: null,
    transactionId: id,
    label: id,
    date,
    ...over,
  }))

const reimbursement = (
  id: string,
  receiver: string,
  shareEach: number,
  date: string,
  receivedAt: string | null,
): ProjectableSplit[] =>
  [A, B].map((memberId) => ({
    currencyCode: 'ARS',
    memberId,
    movementOwnerId: receiver,
    movementKind: 'reimbursement',
    amountAssigned: shareEach,
    gateDueDate: null,
    receivedAt,
    cancelledAt: null,
    transactionId: id,
    label: id,
    date,
  }))

const settle = (
  id: string,
  payer: string,
  receiver: string,
  amount: number,
  date: string,
  status: LedgerSettlement['status'] = 'completed',
): LedgerSettlement => ({
  currencyCode: 'ARS',
  id,
  date,
  payerId: payer,
  receiverId: receiver,
  amount,
  status,
})

const asDebt = (s: LedgerSettlement): DebtSettlement => ({
  currencyCode: s.currencyCode,
  payerId: s.payerId,
  receiverId: s.receiverId,
  amount: s.amount,
  counts: true,
})

describe('deriveCurrentAccount', () => {
  it('the final running balance equals householdDebtAt (the invariant)', () => {
    const splits = [
      ...expense('super', A, 4612.5, '2026-06-05'), // A paid → B owes A 4612.5
      ...expense('expensas', B, 3500, '2026-06-02'), // B paid → A owes B 3500
      ...reimbursement('cashback', A, 600, '2026-06-12', '2026-06-12'),
    ]
    const settlements = [settle('s1', B, A, 5525, '2026-06-18')]
    const acc = deriveCurrentAccount(splits, settlements, 'ARS', '2026-06-30', A, B)
    const debt = householdDebtAt(splits, settlements.map(asDebt), 'ARS', '2026-06-30', A, B)

    // final running == balance == householdDebtAt
    expect(acc.entries[0].runningForA).toBeCloseTo(acc.equation.balanceForA, 2)
    expect(acc.debt).toEqual(debt)
  })

  it('signs the entry by who paid (A paid → +other share; B paid → −your share)', () => {
    const acc = deriveCurrentAccount(
      [...expense('a-paid', A, 50, '2026-06-10'), ...expense('b-paid', B, 30, '2026-06-11')],
      [],
      'ARS',
      '2026-06-30',
      A,
      B,
    )
    const aPaid = acc.entries.find((e) => e.id === 'a-paid')!
    const bPaid = acc.entries.find((e) => e.id === 'b-paid')!
    expect(aPaid.amountForA).toBe(50)
    expect(aPaid.change).toBe('adds_other_share')
    expect(bPaid.amountForA).toBe(-30)
    expect(bPaid.change).toBe('adds_your_share')
  })

  it('orders entries most-recent-first and keeps a coherent running balance', () => {
    const acc = deriveCurrentAccount(
      [...expense('older', A, 100, '2026-06-01'), ...expense('newer', A, 40, '2026-06-20')],
      [],
      'ARS',
      '2026-06-30',
      A,
      B,
    )
    expect(acc.entries.map((e) => e.id)).toEqual(['newer', 'older'])
    // newest on top carries the final cumulative; oldest carries its own.
    expect(acc.entries[0].runningForA).toBe(140)
    expect(acc.entries[1].runningForA).toBe(100)
  })

  it('the equation aggregates sum to the balance', () => {
    const acc = deriveCurrentAccount(
      [
        ...expense('e1', A, 80, '2026-06-03'),
        ...expense('e2', B, 50, '2026-06-04'),
        ...reimbursement('r1', A, 20, '2026-06-12', '2026-06-12'),
      ],
      [settle('s', B, A, 10, '2026-06-15')],
      'ARS',
      '2026-06-30',
      A,
      B,
    )
    const { otherSharesYouPaid, yourSharesTheyPaid, reimbursementsAndSettlements, balanceForA } =
      acc.equation
    expect(otherSharesYouPaid + yourSharesTheyPaid + reimbursementsAndSettlements).toBeCloseTo(
      balanceForA,
      2,
    )
  })

  it('a reversed settlement and its contra cancel out (net zero)', () => {
    const splits = expense('e', A, 100, '2026-06-01') // B owes A 100
    const settlements = [
      settle('orig', B, A, 100, '2026-06-05', 'reversed'),
      settle('contra', A, B, 100, '2026-06-05', 'contra'),
    ]
    const acc = deriveCurrentAccount(splits, settlements, 'ARS', '2026-06-30', A, B)
    // expense +100, reversed settlement (B→A) -100, contra (A→B) +100 → net 100
    expect(acc.equation.balanceForA).toBe(100)
    expect(acc.entries.find((e) => e.id === 'orig')!.state).toBe('reversed')
    expect(acc.entries.find((e) => e.id === 'contra')!.state).toBe('contra')
  })

  it('separates currencies', () => {
    const acc = deriveCurrentAccount(
      [
        ...expense('ars', A, 100, '2026-06-01'),
        ...expense('usd', A, 9, '2026-06-02', { currencyCode: 'USD' }),
      ],
      [],
      'USD',
      '2026-06-30',
      A,
      B,
    )
    expect(acc.entries).toHaveLength(1)
    expect(acc.entries[0].id).toBe('usd')
    expect(acc.equation.balanceForA).toBe(9)
  })
})
