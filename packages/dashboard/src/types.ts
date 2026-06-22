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
   * Net of the month, reconciling with the change in `disponible` by
   * construction (same per-type sign rules as `calculateTransactionSums`):
   * finalBalance = totalIncome − totalExpense − totalCardPayment
   *   + totalAdjustment + totalReimbursement + totalSettlement + totalExchange.
   */
  finalBalance: number
}

/**
 * COMPROMISO lens ("¿qué debo / qué se viene?"), per currency. Static "from
 * today": `debt` is a present stock, the recurring projections are next month.
 * The committed total = debt + recurringExpense (outflows); recurringIncome is
 * context, never summed into the total. ARS and USD are never combined.
 */
export type CommittedCurrency = {
  /** Sum of pending charges (consumos − received reimbursements) across ALL unpaid statements. */
  debt: number
  /** Active `expense` recurrences projected into the next calendar month. */
  recurringExpense: number
  /** Active `income` recurrences projected into the next calendar month (context only). */
  recurringIncome: number
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
