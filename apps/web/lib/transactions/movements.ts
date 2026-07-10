// The `FinancialMovement` union, its view bridge (`toMovementViewInput`) and the
// DB→movement mappers (`toFinancialMovement`, `toInitialBalanceMovement`) now
// live in `@grana/transactions` so mobile (the Movimientos tab, the card
// statement pane) reuses them. Re-exported here so the rest of web keeps
// importing them from `@/lib/transactions/movements` unchanged.
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
} from '@grana/transactions'
export {
  toMovementViewInput,
  toFinancialMovement,
  toInitialBalanceMovement,
  isInitialBalanceMovement,
  INITIAL_BALANCE_ID_PREFIX,
} from '@grana/transactions'
