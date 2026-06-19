import { Money, type MoneyType } from '@grana/validation'
import { projectUpcomingOccurrences, type RuleForProjection } from '@grana/money-logic'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type {
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceDay,
  MonthBalanceSeries,
} from './types'

export type HeroAccountRow = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  color_key: string | null
  icon_key: string | null
  institution: { brand_color: string | null; icon_type: string | null } | null
  currencies: Array<{
    currency_code: string
    initial_balance: number | string | null
  }>
}

export function aggregateHero(
  accounts: HeroAccountRow[],
  txSums: Map<string, { ARS: number; USD: number }>,
): DashboardHero {
  let totalArs = Money.from(0)
  let totalUsd = Money.from(0)
  const breakdown: HeroAccountBalance[] = []

  for (const acc of accounts) {
    const sums = txSums.get(acc.id) ?? { ARS: 0, USD: 0 }
    let accArs = Money.from(0)
    let accUsd = Money.from(0)
    for (const c of acc.currencies) {
      if (c.currency_code === 'ARS') {
        accArs = Money.add(
          accArs,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.ARS)),
        )
      } else if (c.currency_code === 'USD') {
        accUsd = Money.add(
          accUsd,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.USD)),
        )
      }
    }
    totalArs = Money.add(totalArs, accArs)
    totalUsd = Money.add(totalUsd, accUsd)
    breakdown.push({
      id: acc.id,
      name: acc.name,
      ars: Money.toNumber(accArs),
      usd: Money.toNumber(accUsd),
      avatar: resolveAccountAvatar(
        {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          color_key: acc.color_key,
          icon_key: acc.icon_key,
        },
        acc.institution,
      ),
    })
  }

  // ARS is the primary currency (bimoneda): order the breakdown by ARS balance
  // desc, then USD desc, then name for a deterministic top-N on the desktop Hero.
  breakdown.sort(
    (a, b) => b.ars - a.ars || b.usd - a.usd || a.name.localeCompare(b.name),
  )

  return {
    ars: Money.toNumber(totalArs),
    usd: Money.toNumber(totalUsd),
    accounts: breakdown,
  }
}

type BalanceCurrency = 'ARS' | 'USD'

/** Absolute value of a Money (the API is functional: no `.abs()`/`.minus()`). */
function moneyAbs(m: MoneyType): MoneyType {
  return Money.isNegative(m) ? Money.subtract(Money.from(0), m) : m
}

/** Negate a Money. */
function moneyNegate(m: MoneyType): MoneyType {
  return Money.subtract(Money.from(0), m)
}

/**
 * A month-balance input row. Carries every field the CAJA reconciliation needs
 * so the month series applies the SAME per-type sign rules as
 * `calculateTransactionSums` (the source of the Hero/Disponible) and therefore
 * `finalBalance` equals the month's change in `disponible` by construction.
 */
export type MonthBalanceTxInput = {
  date: string
  type:
    | 'income'
    | 'expense'
    | 'transfer'
    | 'adjustment'
    | 'exchange'
    | 'reimbursement'
    | 'settlement'
  amount: number | string
  account_id: string | null
  currency_code: string
  transfer_destination_account_id?: string | null
  /** Destination leg of an exchange (in `destination_currency`). */
  destination_amount?: number | string | null
  destination_currency?: string | null
  /** Reimbursement subtype. */
  reimbursement_target?: 'account' | 'statement' | null
  /** Reimbursement confirmation/cancellation instants (NULL received = pending). */
  received_at?: string | null
  cancelled_at?: string | null
  /** Settlement leg direction: 'out' debits, 'in' credits. */
  settlement_direction?: 'out' | 'in' | null
  /** True when this `expense` is a card statement payment (linked to a period_payments). */
  is_card_payment?: boolean
}

/** Which display bucket a signed contribution belongs to (for the per-bucket totals). */
type CashBucket =
  | 'income'
  | 'expense'
  | 'cardPayment'
  | 'adjustment'
  | 'reimbursement'
  | 'settlement'
  | 'exchange'

/**
 * Classify a row's contribution to ONE currency's running balance, mirroring
 * `calculateTransactionSums`. Returns the signed balance delta (what moves the
 * accumulated balance) and the bucket it should be tallied under, or `null` when
 * the row does not affect this currency on an owned account. `transfer` always
 * returns null: between owned cash/bank accounts both legs net to zero.
 *
 * The bucket total is derived from `signed` (its magnitude or the signed value
 * for the signed buckets), so the per-type sign rules live in exactly one place.
 */
function classifyCashContribution(
  row: MonthBalanceTxInput,
  currency: BalanceCurrency,
  ownedAccountIds: Set<string>,
): { bucket: CashBucket; signed: MoneyType } | null {
  const owns = (id: string | null | undefined) => id != null && ownedAccountIds.has(id)
  const amount = Money.from(row.amount)

  switch (row.type) {
    case 'income':
      if (!owns(row.account_id) || row.currency_code !== currency) return null
      return { bucket: 'income', signed: amount }
    case 'expense':
      if (!owns(row.account_id) || row.currency_code !== currency) return null
      return {
        bucket: row.is_card_payment ? 'cardPayment' : 'expense',
        signed: moneyNegate(amount),
      }
    case 'adjustment':
      // Stored signed: positive raises the balance, negative lowers it.
      if (!owns(row.account_id) || row.currency_code !== currency) return null
      return { bucket: 'adjustment', signed: amount }
    case 'reimbursement':
      // Only a received "a cuenta" reimbursement credits the account, like income.
      if (
        !owns(row.account_id) ||
        row.currency_code !== currency ||
        row.reimbursement_target !== 'account' ||
        row.received_at == null ||
        row.cancelled_at != null
      ) {
        return null
      }
      return { bucket: 'reimbursement', signed: amount }
    case 'settlement':
      if (!owns(row.account_id) || row.currency_code !== currency) return null
      if (row.settlement_direction === 'in') return { bucket: 'settlement', signed: amount }
      if (row.settlement_direction === 'out') {
        return { bucket: 'settlement', signed: moneyNegate(amount) }
      }
      return null
    case 'exchange': {
      // Two legs in (potentially) different currencies: the source leg leaves
      // `currency_code`, the destination leg arrives in `destination_currency`.
      // For the target currency, apply whichever leg matches.
      if (owns(row.account_id) && row.currency_code === currency) {
        return { bucket: 'exchange', signed: moneyNegate(amount) }
      }
      if (
        owns(row.transfer_destination_account_id) &&
        row.destination_currency === currency &&
        row.destination_amount != null
      ) {
        return { bucket: 'exchange', signed: Money.from(row.destination_amount) }
      }
      return null
    }
    case 'transfer':
      // Between owned cash/bank accounts both legs net to zero → no effect.
      return null
  }
}

export function buildMonthBalanceSeries(
  year: number,
  month: number,
  rows: MonthBalanceTxInput[],
  ownedAccountIds: string[],
  currency: BalanceCurrency,
): MonthBalanceSeries {
  const lastDay = new Date(year, month, 0).getDate()
  if (ownedAccountIds.length === 0) {
    return emptyMonthSeries(year, month, lastDay)
  }

  const accIdSet = new Set(ownedAccountIds)
  // Per-day signed delta (drives the accumulated balance) + the three legacy
  // per-day flow buckets still exposed on MonthBalanceDay.
  const dailyDelta = Array.from({ length: lastDay + 1 }, () => Money.from(0))
  const dailyIncome = Array.from({ length: lastDay + 1 }, () => Money.from(0))
  const dailyExpense = Array.from({ length: lastDay + 1 }, () => Money.from(0))
  const dailyAdjustment = Array.from({ length: lastDay + 1 }, () => Money.from(0))

  const totals: Record<CashBucket, MoneyType> = {
    income: Money.from(0),
    expense: Money.from(0),
    cardPayment: Money.from(0),
    adjustment: Money.from(0),
    reimbursement: Money.from(0),
    settlement: Money.from(0),
    exchange: Money.from(0),
  }

  for (const row of rows) {
    const day = parseISODay(row.date)
    if (day < 1 || day > lastDay) continue

    const contribution = classifyCashContribution(row, currency, accIdSet)
    if (!contribution) continue
    const { bucket, signed } = contribution

    // Accumulated balance always tracks the signed delta of every cash movement.
    dailyDelta[day] = Money.add(dailyDelta[day], signed)
    // Per-bucket totals: signed buckets keep the sign; flow buckets the magnitude.
    if (bucket === 'adjustment' || bucket === 'settlement' || bucket === 'exchange') {
      totals[bucket] = Money.add(totals[bucket], signed)
    } else {
      totals[bucket] = Money.add(totals[bucket], moneyAbs(signed))
    }

    if (bucket === 'income') dailyIncome[day] = Money.add(dailyIncome[day], moneyAbs(signed))
    else if (bucket === 'expense') dailyExpense[day] = Money.add(dailyExpense[day], moneyAbs(signed))
    else if (bucket === 'adjustment') dailyAdjustment[day] = Money.add(dailyAdjustment[day], signed)
  }

  const days: MonthBalanceDay[] = []
  let acc = Money.from(0)
  for (let d = 1; d <= lastDay; d++) {
    acc = Money.add(acc, dailyDelta[d])
    days.push({
      day: d,
      accumulatedBalance: Money.toNumber(acc),
      dailyIncome: Money.toNumber(dailyIncome[d]),
      dailyExpense: Money.toNumber(dailyExpense[d]),
      dailyAdjustment: Money.toNumber(dailyAdjustment[d]),
    })
  }

  return {
    year,
    month,
    days,
    totalIncome: Money.toNumber(totals.income),
    totalExpense: Money.toNumber(totals.expense),
    totalAdjustment: Money.toNumber(totals.adjustment),
    totalCardPayment: Money.toNumber(totals.cardPayment),
    totalReimbursement: Money.toNumber(totals.reimbursement),
    totalSettlement: Money.toNumber(totals.settlement),
    totalExchange: Money.toNumber(totals.exchange),
    finalBalance: Money.toNumber(acc),
  }
}

function emptyMonthSeries(
  year: number,
  month: number,
  totalDays: number,
): MonthBalanceSeries {
  return {
    year,
    month,
    days: Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      accumulatedBalance: 0,
      dailyIncome: 0,
      dailyExpense: 0,
      dailyAdjustment: 0,
    })),
    totalIncome: 0,
    totalExpense: 0,
    totalAdjustment: 0,
    totalCardPayment: 0,
    totalReimbursement: 0,
    totalSettlement: 0,
    totalExchange: 0,
    finalBalance: 0,
  }
}

function parseISODay(iso: string): number {
  return Number(iso.split('-')[2])
}

// ── Committed outlook (COMPROMISO lens) — pure aggregations ───────────────────

type OutlookCurrency = 'ARS' | 'USD'

function isOutlookCurrency(c: string): c is OutlookCurrency {
  return c === 'ARS' || c === 'USD'
}

/** A non-parent child charge on an unpaid card statement. */
export type CardDebtRow = {
  type: string
  amount: number | string
  currency_code: string
  status: string | null
  received_at: string | null
  cancelled_at: string | null
}

/**
 * Card debt per currency = pending consumos − received statement reimbursements,
 * across the rows of ALL unpaid statements. Mirrors the per-period pending math
 * in `apps/web/lib/cards/queries.ts`: a received (and not cancelled) statement
 * reimbursement reduces the debt; pending/cancelled ones do not count.
 */
export function aggregateCardDebt(rows: CardDebtRow[]): Record<OutlookCurrency, number> {
  const debt: Record<OutlookCurrency, MoneyType> = { ARS: Money.from(0), USD: Money.from(0) }
  for (const row of rows) {
    if (!isOutlookCurrency(row.currency_code)) continue
    const cur = row.currency_code
    if (row.type === 'reimbursement') {
      if (row.received_at != null && row.cancelled_at == null) {
        debt[cur] = Money.subtract(debt[cur], Money.from(row.amount))
      }
    } else if (row.status === 'pending') {
      debt[cur] = Money.add(debt[cur], Money.from(row.amount))
    }
  }
  return { ARS: Money.toNumber(debt.ARS), USD: Money.toNumber(debt.USD) }
}

/** An active recurrence rule carrying its projection inputs plus amount/type. */
export type CommittedRecurrenceRule = RuleForProjection & {
  amount: number | string
  currency_code: string
  movement_type: 'income' | 'expense' | 'transfer'
}

export type RecurrenceProjectionTotals = {
  expense: Record<OutlookCurrency, number>
  income: Record<OutlookCurrency, number>
}

/**
 * Project active recurrence rules into [windowStart, windowEnd] and sum each
 * occurrence's amount by currency and movement_type. `transfer` rules are
 * ignored (neither a commitment nor incoming context). ARS/USD never combined.
 */
export function aggregateRecurrenceProjection(
  rules: CommittedRecurrenceRule[],
  windowStart: string,
  windowEnd: string,
): RecurrenceProjectionTotals {
  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const occurrences = projectUpcomingOccurrences(
    rules.map((r) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      interval_count: r.interval_count,
      interval_unit: r.interval_unit,
      max_occurrences: r.max_occurrences,
    })),
    windowStart,
    windowEnd,
  )

  const expense: Record<OutlookCurrency, MoneyType> = { ARS: Money.from(0), USD: Money.from(0) }
  const income: Record<OutlookCurrency, MoneyType> = { ARS: Money.from(0), USD: Money.from(0) }
  for (const occ of occurrences) {
    const rule = ruleById.get(occ.rule_id)
    if (!rule || !isOutlookCurrency(rule.currency_code)) continue
    const cur = rule.currency_code
    if (rule.movement_type === 'expense') {
      expense[cur] = Money.add(expense[cur], Money.from(rule.amount))
    } else if (rule.movement_type === 'income') {
      income[cur] = Money.add(income[cur], Money.from(rule.amount))
    }
  }
  return {
    expense: { ARS: Money.toNumber(expense.ARS), USD: Money.toNumber(expense.USD) },
    income: { ARS: Money.toNumber(income.ARS), USD: Money.toNumber(income.USD) },
  }
}

// `calculateTransactionSums` y su tipo viven en @grana/money-logic (fuente
// única, reutilizable por web y mobile). Se re-exportan acá para no romper a
// los consumidores que los importan vía `@grana/dashboard`.
export { calculateTransactionSums, type BalanceTransactionRow } from '@grana/money-logic'
