export {
  getCommittedOutlook,
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

export {
  derivePlacement,
  PLACEMENT_ROWS_PER_CURRENCY,
  type BalancePlacement,
  type CurrencyPlacement,
  type PlacementAccount,
  type PlacementRow,
} from './placement'

export {
  computeConcentration,
  type Concentration,
  type ConcentrationAccount,
  type ConcentrationSegment,
} from './concentration'

export type {
  CommittedCurrency,
  CommittedItem,
  CommittedOutlook,
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceByCurrency,
  MonthBalanceDay,
  MonthBalanceSeries,
} from './types'
