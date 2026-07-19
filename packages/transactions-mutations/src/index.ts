export {
  registerInstallments,
  type RegisterInstallmentsArgs,
  type RegisterInstallmentsResult,
} from './register-installments'

export {
  registerCardPurchase,
  type RegisterCardPurchaseArgs,
  type RegisterCardPurchaseResult,
} from './register-card-purchase'

export {
  saveExpenseReimbursement,
  type SaveExpenseReimbursementArgs,
  type SaveExpenseReimbursementResult,
} from './save-expense-reimbursement'

export {
  createRecurrenceFromMovement,
  type CreateRecurrenceFromMovementArgs,
  type CreateRecurrenceFromMovementResult,
} from './create-recurrence-from-movement'

// Shared mutation helpers — reused by the orchestrators above and by web
// actions for the thin (non-orchestrated) mutation paths (cash expense, debit
// transfer, etc.) that also need household-sharing or period assignment.

export {
  applySharedSplits,
  type SharedSplitSpec,
  type SharedTarget,
} from './internal/shared-splits'

export {
  getCardPeriodsWithStatus,
  getOrCreatePeriodForDate,
  CardPurchasePredatesHistoryError,
  type CardPeriodWithPayment,
} from './internal/card-periods'

export { insertDeclaredReimbursement } from './internal/declared-reimbursement'

// Thin movement mutations (isomorphic): the create/update bodies for simple
// movements, shared by web server actions and the mobile mutators. Auth +
// cache-invalidation stay in each platform's shell.
export {
  verifyActiveCurrency,
  createIncome,
  createExpense,
  createTransfer,
  createAdjustment,
  createExchange,
  updateTransaction,
  updateTransfer,
  updateAdjustment,
  updateExchange,
  deleteTransaction,
  DELETE_GUARD_CODES,
  type ThinMutationResult,
} from './thin-mutations'
