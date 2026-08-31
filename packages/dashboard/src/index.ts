export {
  getAvailableTotals,
  getCommittedOutlook,
  getDashboardHero,
  getMonthBalanceSeries,
  getMonthCategoryBreakdown,
  getMonthIncomeBreakdown,
  getMonthSpending,
  getMonthSubcategoryBreakdown,
  hasUsdAccount,
  resolveMonthRange,
  SUBCATEGORY_UNCATEGORIZED_ID,
  UNCATEGORIZED_ID,
  type CurrencyTotals,
  type MonthCategoryBreakdown,
  type MonthSubcategoryBreakdown,
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
  amountDensity,
  densestAmountDensity,
  PACE_OVERFLOW_PCT,
  type AmountDensity,
  type CommittedSplit,
  type MonthSpending,
  type SpendingPace,
} from './spending'

export { deriveMonthOpening } from './month-opening'

export { deriveBalanceCardView, type BalanceCardView } from './balance-card-view'

export {
  deriveSavingsRow,
  savingsIdentityTerm,
  type SavingsRow,
  type SavingsRowState,
} from './savings-row'

export {
  aggregateMonthSpending,
  type MonthSpendingByCurrency,
  type MonthSpendingRow,
  type MonthSpendingSplit,
} from './month-spending'

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
