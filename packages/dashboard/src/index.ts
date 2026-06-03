export {
  getDashboardHero,
  getUpcomingFortnight,
  getMonthBalanceSeries,
  getMonthCategoryBreakdown,
  hasUserMovements,
  resolveMonthRange,
  UNCATEGORIZED_ID,
  type MonthCategoryBreakdown,
} from './queries'

export {
  aggregateHero,
  buildUpcomingFortnight,
  buildMonthBalanceSeries,
  calculateTransactionSums,
  type HeroAccountRow,
  type UpcomingCardPeriodInput,
  type UpcomingPeriodTxInput,
  type UpcomingRecurrenceInstanceInput,
  type MonthBalanceTxInput,
  type BalanceTransactionRow,
} from './aggregations'

export type {
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceByCurrency,
  MonthBalanceDay,
  MonthBalanceSeries,
  UpcomingDirection,
  UpcomingFortnight,
  UpcomingItem,
  UpcomingItemKind,
  UpcomingItemTarget,
} from './types'
