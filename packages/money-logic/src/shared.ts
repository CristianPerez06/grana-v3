import { Money, type MoneyType } from '@grana/validation'
import type { BalanceCurrency } from './balance'

/**
 * Shared module (Compartido) — pure debt math. The caller (web/mobile queries)
 * fetches the shared splits and settlements from Supabase, pre-filters what
 * currently counts (received reimbursements, due installments) and passes plain
 * rows here. No I/O, no React, no DB types. See
 * openspec/changes/add-shared-expenses/design.md (D2, D9, D11).
 */

// ─── Split a shared amount by percentages ────────────────────────────────────

/**
 * Split `amount` across `percentages` (each 1..100, summing 100), distributing
 * the rounding residue to the FIRST part so the parts sum EXACTLY to `amount`
 * (no centavo lost or invented). Mirrors the residue handling of `Money.split`.
 */
export function splitAmountByPercentages(
  amount: number | string,
  percentages: number[],
): MoneyType[] {
  if (percentages.length === 0) return []
  const total = Money.from(amount)
  const parts = percentages.map((p) => Money.multiply(total, p / 100))
  const sum = parts.reduce((acc, m) => Money.add(acc, m), Money.from(0))
  const residue = Money.subtract(total, sum)
  parts[0] = Money.add(parts[0], residue)
  return parts
}

// ─── Installment / reimbursement period gating ───────────────────────────────

/**
 * Whether a movement currently counts toward the debt, given a reference date.
 * A future credit-card installment (its `dueDate` falls in a month AFTER the
 * reference month) does not count until its month arrives; each cuota adds its
 * share of debt only when due. A `null` dueDate (cash/debit or non-installment)
 * always counts. The same gate aligns an "en resumen" reimbursement with the
 * period of the cuota it reduces. Pure: dates are 'YYYY-MM-DD' strings, compared
 * by year-month so there is no timezone dependency.
 */
export function countsByPeriod(dueDate: string | null | undefined, asOf: string): boolean {
  if (!dueDate) return true
  return dueDate.slice(0, 7) <= asOf.slice(0, 7)
}

// ─── Derived household debt ──────────────────────────────────────────────────

/**
 * One member's split of a shared movement, annotated with what the debt formula
 * needs. `movementOwnerId` is who paid the expense / received the reimbursement.
 * `counts` is decided by the query: future installments and pending/cancelled
 * reimbursements are `false`; due installments and received reimbursements `true`.
 */
export type DebtMovementSplit = {
  currencyCode: BalanceCurrency
  memberId: string
  movementOwnerId: string
  movementKind: 'expense' | 'reimbursement'
  amountAssigned: number | string
  counts: boolean
}

/** A registered settlement (debt repayment) between two members. */
export type DebtSettlement = {
  currencyCode: BalanceCurrency
  payerId: string
  receiverId: string
  amount: number | string
  counts: boolean
}

/** Net balance per member id, in `number` form. Positive = owed; negative = owes. */
export type MemberBalances = Record<string, number>

/** Debt amounts below this (in absolute value) are treated as "settled". */
const DEBT_TOLERANCE = 0.01

/**
 * Net balance per member for ONE currency. Positive = the member is owed money;
 * negative = the member owes. Across all members it sums to zero. Pure.
 *
 * Signed sum (D9):
 * - expense split (member ≠ payer): the payer fronted the member's share → the
 *   member owes the payer that share.
 * - reimbursement split (member ≠ receiver): reverses it → the receiver owes the
 *   member back their share of the refund.
 * - settlement: the payer paid the receiver → reduces what the payer owed.
 */
export function computeHouseholdBalances(
  splits: DebtMovementSplit[],
  settlements: DebtSettlement[],
  currency: BalanceCurrency,
): MemberBalances {
  const bal = new Map<string, MoneyType>()
  const get = (id: string) => bal.get(id) ?? Money.from(0)
  const credit = (id: string, m: MoneyType) => bal.set(id, Money.add(get(id), m))
  const debit = (id: string, m: MoneyType) => bal.set(id, Money.subtract(get(id), m))

  for (const s of splits) {
    if (s.currencyCode !== currency || !s.counts) continue
    if (s.memberId === s.movementOwnerId) continue // own share creates no debt
    const share = Money.from(s.amountAssigned)
    if (s.movementKind === 'expense') {
      credit(s.movementOwnerId, share) // owner is owed the member's share
      debit(s.memberId, share) // member owes it
    } else {
      // reimbursement received by the owner: the member's share is credited back
      debit(s.movementOwnerId, share)
      credit(s.memberId, share)
    }
  }

  for (const t of settlements) {
    if (t.currencyCode !== currency || !t.counts) continue
    const amt = Money.from(t.amount)
    credit(t.payerId, amt) // paying down reduces what the payer owed
    debit(t.receiverId, amt)
  }

  const out: MemberBalances = {}
  for (const [id, m] of bal) out[id] = Money.toNumber(m)
  return out
}

export type PairwiseDebt =
  | { kind: 'settled' }
  | { kind: 'owes'; from: string; to: string; amount: number }

/**
 * Pairwise debt between two members from their net balances, for one currency.
 * Amounts under one centavo are reported as settled. For a 2-member household
 * `balances[memberA] === -balances[memberB]` by construction.
 */
export function pairwiseDebt(
  balances: MemberBalances,
  memberA: string,
  memberB: string,
): PairwiseDebt {
  const a = balances[memberA] ?? 0
  if (Math.abs(a) < DEBT_TOLERANCE) return { kind: 'settled' }
  // a > 0 → A is owed → B owes A; a < 0 → A owes B.
  return a > 0
    ? { kind: 'owes', from: memberB, to: memberA, amount: a }
    : { kind: 'owes', from: memberA, to: memberB, amount: -a }
}
