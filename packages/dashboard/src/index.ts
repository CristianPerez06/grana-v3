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
  aggregateCardDebtByCard,
  aggregateHero,
  buildMonthBalanceSeries,
  calculateTransactionSums,
  type CommittedCardMeta,
  type HeroAccountRow,
  type MonthBalanceTxInput,
  type BalanceTransactionRow,
} from './aggregations'

export {
  deriveCommittedSplit,
  deriveMonthSpending,
  deriveSpendingPace,
  type CommittedSplit,
  type MonthSpending,
  type SpendingPace,
} from './spending'

export {
  deriveMonthSummary,
  type MonthSummary,
  type MonthSummaryByCurrency,
} from './month-summary'

export {
  derivePlacement,
  PLACEMENT_ROWS_PER_CURRENCY,
  type BalancePlacement,
  type CurrencyPlacement,
  type PlacementAccount,
  type PlacementRow,
} from './placement'

export type {
  CommittedCardRow,
  CommittedCurrency,
  CommittedItem,
  CommittedOutlook,
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceByCurrency,
  MonthBalanceDay,
  MonthBalanceSeries,
} from './types'
