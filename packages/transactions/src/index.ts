export {
  getAccountMovementsAscending,
  getPendingReimbursements,
  // Global movements feed (the `/transactions` list + the mobile Movimientos
  // tab): paginated read over the get_movements_page RPC.
  getGlobalMovements,
  getGlobalMovementsPage,
  hasAnyTransaction,
  // Internal helpers shared with the web-retained transactions feed reads
  // (getTransactions, getTransactionDetail, getInstallmentFamily) so the select
  // shape and the linked-expense / history-row rules are not duplicated.
  TRANSACTION_SELECT,
  attachLinkedExpenses,
  isHistoryRow,
} from './queries'

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
