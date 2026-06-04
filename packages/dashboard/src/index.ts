export {
  getDashboardHero,
  getMonthBalanceSeries,
  getMonthCategoryBreakdown,
  resolveMonthRange,
  UNCATEGORIZED_ID,
  type MonthCategoryBreakdown,
} from './queries'

export {
  aggregateHero,
  buildMonthBalanceSeries,
  calculateTransactionSums,
  type HeroAccountRow,
  type MonthBalanceTxInput,
  type BalanceTransactionRow,
} from './aggregations'

export type {
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceByCurrency,
  MonthBalanceDay,
  MonthBalanceSeries,
} from './types'
