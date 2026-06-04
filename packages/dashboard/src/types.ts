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
}

export type MonthBalanceSeries = {
  year: number
  month: number
  days: MonthBalanceDay[]
  totalIncome: number
  totalExpense: number
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
