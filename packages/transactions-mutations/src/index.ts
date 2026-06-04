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
  type CardPeriodWithPayment,
} from './internal/card-periods'

export { insertDeclaredReimbursement } from './internal/declared-reimbursement'
