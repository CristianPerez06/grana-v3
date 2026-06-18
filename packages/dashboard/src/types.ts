import type { ResolvedAccountAvatar } from '@grana/ui-contracts'

export type HeroAccountBalance = {
  id: string
  name: string
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
  totalExpense: number
  /**
   * Net of `type='adjustment'` movements for the month, signed. Adjustments
   * are stock corrections, not flow: they stay out of totalIncome/totalExpense
   * (so those reflect real flow and "Gastos" reconciles with "En qué se fue")
   * but still affect finalBalance. Invariant:
   * finalBalance === totalIncome − totalExpense + totalAdjustment.
   */
  totalAdjustment: number
  finalBalance: number
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
