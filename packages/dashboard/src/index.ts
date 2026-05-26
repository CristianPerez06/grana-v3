export {
  getDashboardHero,
  getUpcomingFortnight,
  getMonthBalanceSeries,
  hasUserMovements,
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
  MonthBalanceDay,
  MonthBalanceSeries,
  UpcomingDirection,
  UpcomingFortnight,
  UpcomingItem,
  UpcomingItemKind,
  UpcomingItemTarget,
} from './types'
