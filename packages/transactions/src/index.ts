export {
  getAccountMovementsAscending,
  getPendingReimbursements,
  // Global movements feed (the `/transactions` list + the mobile Movimientos
  // tab): paginated read over the get_movements_page RPC.
  getGlobalMovements,
  getGlobalMovementsPage,
  hasAnyTransaction,
  // Transaction-graph detail reads (the web detail page + the mobile
  // `/transactions/[txId]` screen). Isomorphic; same select/enrich as the feed.
  getTransactionDetail,
  getInstallmentFamily,
  getReimbursementsForExpense,
  // The drilled reconciliation list of a category ("En qué se fue"). It lives
  // HERE and not next to `getMonthCategoryBreakdown` in `@grana/dashboard`
  // because it needs the movement machinery below (`TRANSACTION_SELECT`,
  // `attachLinkedExpenses`, `toFinancialMovement`), and this package already
  // depends on `@grana/dashboard` — putting it there would close the cycle.
  getMonthCategoryLines,
  // Internal helpers shared with the web-retained transactions feed reads
  // (getTransactions, getMonthCategoryLines) so the select shape and the
  // linked-expense / history-row rules are not duplicated.
  TRANSACTION_SELECT,
  attachLinkedExpenses,
  isHistoryRow,
} from './queries'
export type { ExpenseReimbursementVM, MonthCategoryLines } from './queries'

export type {
  Transaction,
  TransactionType,
  ReimbursementTarget,
  TransactionCategory,
  TransactionSubcategory,
  TransactionAccount,
  TransactionWithDetails,
  PendingReimbursementVM,
} from './types'

// Display-VM layer: the `FinancialMovement` union a movement row renders, the
// pure bridge to `resolveMovementView`, and the DB→movement mappers of the
// global feed (shared with the mobile Movimientos tab).
export {
  toMovementViewInput,
  toFinancialMovement,
  toInitialBalanceMovement,
  isInitialBalanceMovement,
  INITIAL_BALANCE_ID_PREFIX,
} from './movements'
export type {
  FinancialMovement,
  MovementReviewFlag,
  ReimbursementState,
  IncomeMovement,
  ExpenseMovement,
  CardPaymentMovement,
  TransferMovement,
  AdjustmentMovement,
  CardInstallmentMovement,
  ExchangeMovement,
  ReimbursementMovement,
} from './movements'

// Movement filters contract + month helpers (the `/transactions` feed, the
// mobile Movimientos tab, and the account-detail client filtering).
export {
  resolveMonthRange,
  monthOf,
  shiftMonth,
  movementMatchesText,
  SUBCATEGORY_NONE_MARKER,
  DEFAULT_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENT_TYPE_KEYS,
} from './filters'
export type {
  MovementFilters,
  MovementTypeFilter,
  MovementCurrencyFilter,
} from './filters'

// Amount tone (pure). `toneToClass` (Tailwind) stays in web.
export { resolveTone } from './tone'
export type { Tone } from './tone'

// Option catalog for the movement filters sheet (accounts / categories /
// subcategories of the active category), shared by web and mobile.
export { getMovementFilterOptions } from './filter-options'
export type { MovementFilterOptions } from './filter-options'
