import type { ResolvedAccountAvatar } from '@grana/ui-contracts'

export type HeroAccountBalance = {
  id: string
  /** User-given account name (e.g. "Caja de ahorro sueldo"). */
  name: string
  /** Bank/institution display name when the account has one; null for cash. */
  institutionName: string | null
  ars: number
  usd: number
  avatar: ResolvedAccountAvatar
}

export type DashboardHero = {
  ars: number
  usd: number
  /**
   * Per-account breakdown (cash/bank only), ordered by ARS balance desc.
   * Feeds the "Dónde está" card on both platforms.
   */
  accounts: HeroAccountBalance[]
}

export type MonthBalanceDay = {
  day: number
  accumulatedBalance: number
  dailyIncome: number
  dailyExpense: number
  /**
   * Net balance adjustments of the day, signed (positive raises the balance,
   * negative lowers it). Kept in its own bucket so it feeds the accumulated
   * balance without contaminating dailyIncome/dailyExpense.
   */
  dailyAdjustment: number
}

export type MonthBalanceSeries = {
  year: number
  month: number
  days: MonthBalanceDay[]
  totalIncome: number
  /** Real expense only (`type='expense'` that is NOT a card statement payment). */
  totalExpense: number
  /**
   * Net of `type='adjustment'` movements for the month, signed. Adjustments
   * are stock corrections, not flow: they stay out of totalIncome/totalExpense
   * (so those reflect real flow and "Gastos" reconciles with "En qué se fue")
   * but still affect finalBalance.
   */
  totalAdjustment: number
  /**
   * Card statement payments of the month (the `expense` on cash/bank linked to
   * a `period_payments`). Kept out of `totalExpense` (it cancels already-accrued
   * debt, it is not new spending) but it IS a real cash outflow, so it lowers
   * `finalBalance`.
   */
  totalCardPayment: number
  /** Received "a cuenta" reimbursements (credit the account, like income). */
  totalReimbursement: number
  /** Net of debt settlements, signed: `in` adds, `out` subtracts. */
  totalSettlement: number
  /**
   * Net of currency-exchange legs for THIS currency, signed: the source leg
   * (money leaving this currency) subtracts, the destination leg (money arriving
   * in this currency) adds. Reconciles per-currency, never summed across ARS/USD.
   */
  totalExchange: number
  /**
   * Residual of transfers with only ONE owned leg, signed: money leaving the
   * owned universe subtracts, money arriving adds. **Zero whenever both legs are
   * owned accounts** — the normal case — which is why the UI renders no row for
   * it. It exists so `finalBalance` keeps reconciling with the Disponible when a
   * transfer touches an account outside the owned universe (e.g. an archived
   * one), instead of the series silently netting it to zero.
   */
  totalTransfer: number
  /**
   * Net of the month, reconciling with the change in `disponible` by
   * construction (same per-type sign rules as `calculateTransactionSums`):
   * finalBalance = totalIncome − totalExpense − totalCardPayment
   *   + totalAdjustment + totalReimbursement + totalSettlement + totalExchange
   *   + totalTransfer.
   */
  finalBalance: number
}

/** One listed movement in a committed section (top-by-amount detail). */
export type CommittedItem = {
  /** Movement description (consumo merchant / recurrence label). */
  description: string
  /** ISO date: card tx `date` or recurrence instance `scheduled_date`. */
  date: string
  /** Positive amount in the section's currency. */
  amount: number
}

/**
 * COMPROMISO lens ("obligaciones pendientes": ¿qué tengo que pagar y no pagué?),
 * per currency. `debt` is the card "A pagar" (same definition as the Tarjetas
 * module header); `recurringExpense` is recurrences pending confirmation. The
 * committed total = debt + recurringExpense; recurringIncome is context for the
 * "Ya entra" band, never summed. ARS and USD are never combined.
 *
 * NOTE: field names `debt`/`recurringExpense` are kept for back-compat with the
 * current card UI, but their MEANING changed with the redesign (see below). The
 * UI redesign relabels them to "Tarjeta · a pagar" / "Recurrencias · pendientes".
 */
export type CommittedCurrency = {
  /**
   * Card debt: pending consumos − received reimbursements across unpaid statements
   * already STARTED (start_date <= today) = "A pagar" (closed/overdue) + "En curso"
   * (open statement) from the Tarjetas module. Excludes FUTURE statements
   * (installments 2..N, projected periods) — that was the inflation bug.
   */
  debt: number
  /**
   * Of `debt`, the portion that comes from OVERDUE statements (due_date < today).
   * Drives the "incluye $X vencido" flag. 0 when nothing is overdue.
   */
  overdue: number
  /** Recurrences pending confirmation: sum of pending `expense` recurrence instances. */
  recurringExpense: number
  /** Active `income` recurrences projected into the next calendar month (context for "Ya entra", never summed). */
  recurringIncome: number
  /** Top card consumos of the "A pagar" set, by amount desc (section detail). */
  topCard: CommittedItem[]
  /** Top pending recurrences, by amount desc (section detail). */
  topRecurring: CommittedItem[]
}

export type CommittedOutlook = {
  ARS: CommittedCurrency
  USD: CommittedCurrency
}

/**
 * Per-currency month balance. ARS and USD are never summed (bimoneda): the
 * dashboard shows the ARS totals as the headline and the USD totals in a
 * subordinate strip. The daily series stays available for future temporal
 * views (the accumulated line chart was retired by the dashboard redesign).
 */
export type MonthBalanceByCurrency = {
  year: number
  month: number
  ARS: MonthBalanceSeries
  USD: MonthBalanceSeries
}
