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

/**
 * Whether a shared reimbursement currently reduces the household debt. It must
 * be received (`receivedAt` set, not cancelled) and its own period must have
 * arrived. A received "a cuenta" reimbursement (no due date) counts now — it is
 * real money that already moved, so it impacts the balance today even if the
 * expense it offsets is a card purchase that only settles in a later month; the
 * forward view of that expense is surfaced by the projection, not by deferring
 * the reimbursement. An "en resumen" reimbursement carries the due date of the
 * statement it lands in and counts then. Pure: 'YYYY-MM-DD' compared by year-month.
 */
export function reimbursementCountsTowardDebt(
  receivedAt: string | null | undefined,
  cancelledAt: string | null | undefined,
  dueDate: string | null | undefined,
  asOf: string,
): boolean {
  if (receivedAt == null || cancelledAt != null) return false
  return countsByPeriod(dueDate, asOf)
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

// ─── Monthly projection (próximos compromisos) ───────────────────────────────

/**
 * A split kept in raw, projectable form: its debt contribution is re-gated per
 * reference month so the same dataset answers "what counts today" and "what
 * enters next month". `gateDueDate` is the date that gates it — each movement by
 * its own due date (D1). `transactionId` + `label` let the projection itemise
 * what lands in each upcoming month.
 */
export type ProjectableSplit = {
  currencyCode: BalanceCurrency
  memberId: string
  movementOwnerId: string
  movementKind: 'expense' | 'reimbursement'
  amountAssigned: number | string
  gateDueDate: string | null
  receivedAt: string | null
  cancelledAt: string | null
  transactionId: string
  label: string
  /** The movement's own accounting date (used to order the ledger when there is
   *  no gating due date — cash/debit). 'YYYY-MM-DD'. */
  date: string
}

/**
 * How a split moves member A's net balance (positive = A is owed more). Own-share
 * splits create no debt. Mirrors the signed sum of `computeHouseholdBalances`.
 */
export function splitContributionForA(s: ProjectableSplit, memberA: string): number {
  if (s.memberId === s.movementOwnerId) return 0
  const amt = typeof s.amountAssigned === 'string' ? Number(s.amountAssigned) : s.amountAssigned
  const sign = s.movementKind === 'expense' ? 1 : -1
  if (s.movementOwnerId === memberA) return sign * amt // A paid: A is owed (expense) / owes back (reimb)
  if (s.memberId === memberA) return -sign * amt // A's share: A owes (expense) / is credited (reimb)
  return 0
}

/** Re-gate a projectable split to a concrete `DebtMovementSplit` for `asOf`. */
export function gateSplit(s: ProjectableSplit, asOf: string): DebtMovementSplit {
  const counts =
    s.movementKind === 'reimbursement'
      ? reimbursementCountsTowardDebt(s.receivedAt, s.cancelledAt, s.gateDueDate, asOf)
      : countsByPeriod(s.gateDueDate, asOf)
  return {
    currencyCode: s.currencyCode,
    memberId: s.memberId,
    movementOwnerId: s.movementOwnerId,
    movementKind: s.movementKind,
    amountAssigned: s.amountAssigned,
    counts,
  }
}

/** Net debt between two members for one currency, evaluated at `asOf`. */
export function householdDebtAt(
  splits: ProjectableSplit[],
  settlements: DebtSettlement[],
  currency: BalanceCurrency,
  asOf: string,
  memberA: string,
  memberB: string,
): PairwiseDebt {
  const gated = splits.map((s) => gateSplit(s, asOf))
  return pairwiseDebt(computeHouseholdBalances(gated, settlements, currency), memberA, memberB)
}

/** One movement that lands in a projected month, with its effect on A. */
export type OutlookItem = {
  transactionId: string
  label: string
  /** Effect on A's balance for that month (negative = A owes more). */
  amountForA: number
}

export type OutlookMonth = {
  /** 'YYYY-MM' of the projected month. */
  month: string
  /** The cumulative net debt at the end of that month (positive = B owes A). */
  cumulativeForA: number
  /** What this month adds vs. the previous one (positive = B owes A more). */
  deltaForA: number
  /** The movements that land in this month (sum of `amountForA` === `deltaForA`). */
  items: OutlookItem[]
}

/**
 * Project the cumulative debt, the per-month increment ("lo que entra") and the
 * itemised movements landing in each month, for one currency. `asOfByMonth` maps
 * each 'YYYY-MM' to a reference date within it. The delta of the first entry is
 * measured against `baselineForA` (the debt the month just before the sequence).
 * A movement lands in a month when its own gate date falls in that month (so
 * already-counted "a cuenta" splits sit in the baseline, not in a future month).
 * Pure: re-gates the same splits per month; no I/O.
 */
export function householdOutlook(
  splits: ProjectableSplit[],
  settlements: DebtSettlement[],
  currency: BalanceCurrency,
  asOfByMonth: Array<{ month: string; asOf: string }>,
  memberA: string,
  baselineForA: number,
): OutlookMonth[] {
  let prev = baselineForA
  const out: OutlookMonth[] = []
  for (const { month, asOf } of asOfByMonth) {
    const gated = splits.map((s) => gateSplit(s, asOf))
    const cumulativeForA = computeHouseholdBalances(gated, settlements, currency)[memberA] ?? 0

    // Movements whose gate month is exactly this month, grouped by transaction.
    const byTx = new Map<string, OutlookItem>()
    for (const s of splits) {
      if (s.currencyCode !== currency) continue
      if (!s.gateDueDate || s.gateDueDate.slice(0, 7) !== month) continue
      if (s.movementKind === 'reimbursement' && (s.receivedAt == null || s.cancelledAt != null)) continue
      const c = splitContributionForA(s, memberA)
      if (c === 0) continue
      const cur = byTx.get(s.transactionId) ?? {
        transactionId: s.transactionId,
        label: s.label,
        amountForA: 0,
      }
      cur.amountForA += c
      byTx.set(s.transactionId, cur)
    }
    const items = [...byTx.values()]
      .filter((i) => Math.abs(i.amountForA) > 0.01)
      .sort((a, b) => Math.abs(b.amountForA) - Math.abs(a.amountForA))

    out.push({ month, cumulativeForA, deltaForA: cumulativeForA - prev, items })
    prev = cumulativeForA
  }
  return out
}

// ─── Cuenta corriente (derived ledger) ───────────────────────────────────────

/** A settlement enriched for the ledger: identity, date and display status. */
export type LedgerSettlement = {
  currencyCode: BalanceCurrency
  id: string
  date: string
  payerId: string
  receiverId: string
  amount: number | string
  /** `reversed` = original anulada por contraasiento; `contra` = el contraasiento. */
  status: 'completed' | 'pending' | 'reversed' | 'contra'
}

/** Semantic of "qué cambia" — the UI maps it to natural-language copy. */
export type LedgerChange =
  | 'adds_other_share' // gasto que pagó A: suma la parte del otro (+)
  | 'adds_your_share' // gasto que pagó el otro: suma tu parte (−)
  | 'reduces_debt' // reintegro: baja la deuda
  | 'reduces_balance' // liquidación: reduce el saldo
  | 'restores_amount' // contraasiento: restaura el importe

export type LedgerEntry = {
  id: string
  /** Impact date 'YYYY-MM-DD' (gating date when present, else the movement date). */
  date: string
  label: string
  kind: 'expense' | 'reimbursement' | 'settlement'
  /** Settlement display state; `null` for expense/reimbursement. */
  state: 'completed' | 'pending' | 'reversed' | 'contra' | null
  /** Who paid the expense / registered the settlement (for "Pagó X · split"). */
  payerId: string | null
  /** Signed effect on member A's balance (positive = in A's favour). */
  amountForA: number
  /** Running balance for A after this entry (positive = B owes A). */
  runningForA: number
  change: LedgerChange
}

export type CurrentAccountEquation = {
  /** Partes del otro en lo que pagó A (+). */
  otherSharesYouPaid: number
  /** Tus partes en lo que pagó el otro (−). */
  yourSharesTheyPaid: number
  /** Reintegros y liquidaciones (cobradas). */
  reimbursementsAndSettlements: number
  /** = los tres anteriores. Positive = B owes A. */
  balanceForA: number
}

export type CurrentAccount = {
  currency: BalanceCurrency
  /** Entries in DISPLAY order (most recent first). */
  entries: LedgerEntry[]
  equation: CurrentAccountEquation
  debt: PairwiseDebt
}

/**
 * Derive the cuenta corriente (running ledger) for one currency at `asOf`, from
 * the same splits + settlements as the debt. Each shared expense/reimbursement is
 * one entry (grouped by transaction) signed by its effect on member A; each
 * settlement is one entry. The running balance is the cumulative effect on A and
 * its final value EQUALS `householdDebtAt` for A (same inputs, same gating). The
 * equation aggregates the entries into the four boxes shown in the UI. Pure;
 * `Money` accumulation so there is no centavo drift. See spec `shared`
 * "El usuario puede ver la cuenta corriente del hogar".
 */
export function deriveCurrentAccount(
  splits: ProjectableSplit[],
  settlements: LedgerSettlement[],
  currency: BalanceCurrency,
  asOf: string,
  memberA: string,
  _memberB: string,
): CurrentAccount {
  type Draft = Omit<LedgerEntry, 'runningForA'> & { amt: MoneyType }
  const byTx = new Map<string, Draft>()

  for (const s of splits) {
    if (s.currencyCode !== currency) continue
    const counts =
      s.movementKind === 'reimbursement'
        ? reimbursementCountsTowardDebt(s.receivedAt, s.cancelledAt, s.gateDueDate, asOf)
        : countsByPeriod(s.gateDueDate, asOf)
    if (!counts) continue
    const c = splitContributionForA(s, memberA)
    const impactDate =
      s.movementKind === 'reimbursement'
        ? s.gateDueDate ?? s.receivedAt?.slice(0, 10) ?? s.date // receivedAt is a timestamp
        : s.gateDueDate ?? s.date
    const existing = byTx.get(s.transactionId)
    if (existing) {
      existing.amt = Money.add(existing.amt, Money.from(c))
      existing.amountForA = Money.toNumber(existing.amt)
    } else {
      const paidByA = s.movementOwnerId === memberA
      byTx.set(s.transactionId, {
        id: s.transactionId,
        date: impactDate,
        label: s.label,
        kind: s.movementKind,
        state: null,
        payerId: s.movementOwnerId,
        amt: Money.from(c),
        amountForA: c,
        change:
          s.movementKind === 'reimbursement'
            ? 'reduces_debt'
            : paidByA
              ? 'adds_other_share'
              : 'adds_your_share',
      })
    }
  }

  const drafts: Draft[] = [...byTx.values()]

  for (const t of settlements) {
    if (t.currencyCode !== currency) continue
    const amt = Money.from(t.amount)
    // A settlement reduces what the payer owed: +amount to the payer's balance.
    const forA = t.payerId === memberA ? amt : t.receiverId === memberA ? Money.subtract(Money.from(0), amt) : Money.from(0)
    drafts.push({
      id: t.id,
      date: t.date,
      label: t.status === 'contra' ? 'Reversión de liquidación' : 'Liquidación',
      kind: 'settlement',
      state: t.status,
      payerId: t.payerId,
      amt: forA,
      amountForA: Money.toNumber(forA),
      change: t.status === 'contra' ? 'restores_amount' : 'reduces_balance',
    })
  }

  // Chronological ASC to compute the running balance (id as a stable tiebreaker).
  drafts.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )

  let running = Money.from(0)
  let other = Money.from(0)
  let yours = Money.from(0)
  let reimbSettle = Money.from(0)
  const asc: LedgerEntry[] = drafts.map((d) => {
    running = Money.add(running, d.amt)
    if (d.kind === 'expense') {
      if (d.payerId === memberA) other = Money.add(other, d.amt)
      else yours = Money.add(yours, d.amt)
    } else {
      reimbSettle = Money.add(reimbSettle, d.amt)
    }
    const { amt: _omit, ...rest } = d
    return { ...rest, runningForA: Money.toNumber(running) }
  })

  const balanceForA = Money.toNumber(running)
  const debt: PairwiseDebt =
    Math.abs(balanceForA) < DEBT_TOLERANCE
      ? { kind: 'settled' }
      : balanceForA > 0
        ? { kind: 'owes', from: _memberB, to: memberA, amount: balanceForA }
        : { kind: 'owes', from: memberA, to: _memberB, amount: -balanceForA }

  return {
    currency,
    entries: asc.reverse(), // display: most recent first
    equation: {
      otherSharesYouPaid: Money.toNumber(other),
      yourSharesTheyPaid: Money.toNumber(yours),
      reimbursementsAndSettlements: Money.toNumber(reimbSettle),
      balanceForA,
    },
    debt,
  }
}
