import * as yup from 'yup'

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

export const createIncomeSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    date: yup.string().label('date').required(),
    category_id: yup.string().label('category_id').uuid().required(),
    subcategory_id: yup.string().label('subcategory_id').uuid().optional(),
    description: yup.string().label('description').optional(),
  })
  .strict()

// Reimbursement (reintegro / cashback) declared while registering an expense.
// `estimated_amount` is what the user expects; `amount` (received-now case) is
// the real amount, defaulting to the estimate. `target='statement'` reduces a
// card period; `target='account'` credits a cash/bank account at `account_id`.
export const reimbursementDeclarationSchema = yup
  .object({
    target: yup.string().label('target').required().oneOf(['account', 'statement']),
    estimated_amount: yup.number().label('estimated_amount').required().positive(),
    // 'account': cash/bank account credited; 'statement': the card whose period it reduces.
    account_id: yup.string().label('account_id').uuid().required(),
    card_period_id: yup.string().label('card_period_id').uuid().optional(),
    // when true, the reimbursement is already received at creation (a fact, not a pending).
    received_now: yup.boolean().label('received_now').default(false),
    // accounting date: expected date (pending) or real date (received). Defaults to today.
    date: yup.string().label('date').optional(),
    // real amount, only meaningful when received_now; defaults to estimated_amount.
    amount: yup.number().label('amount').positive().optional(),
    description: yup.string().label('description').optional(),
  })
  .strict()

export const confirmReimbursementSchema = yup
  .object({
    id: yup.string().label('id').uuid().required(),
    amount: yup.number().label('amount').required().positive(),
    date: yup.string().label('date').required(),
    // reconcile the real account ('account') or the period where it landed ('statement').
    account_id: yup.string().label('account_id').uuid().optional(),
    card_period_id: yup.string().label('card_period_id').uuid().optional(),
  })
  .strict()

export const cancelReimbursementSchema = yup
  .object({
    id: yup.string().label('id').uuid().required(),
  })
  .strict()

export const createExpenseSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    date: yup.string().label('date').required(),
    category_id: yup.string().label('category_id').uuid().required(),
    subcategory_id: yup.string().label('subcategory_id').uuid().optional(),
    description: yup.string().label('description').optional(),
    reimbursement: reimbursementDeclarationSchema.optional().default(undefined),
  })
  .strict()

export const updateTransactionSchema = yup
  .object({
    amount: yup.number().label('amount').positive().optional(),
    date: yup.string().label('date').optional(),
    description: yup.string().label('description').nullable().optional(),
    category_id: yup.string().label('category_id').uuid().nullable().optional(),
    subcategory_id: yup.string().label('subcategory_id').uuid().nullable().optional(),
  })
  .strict()

export const createTransferSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    transfer_destination_account_id: yup
      .string()
      .label('transfer_destination_account_id')
      .uuid()
      .required()
      .test(
        'not-same-as-source',
        'destination_same_as_source',
        function (value) {
          return value !== this.parent.account_id
        },
      ),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    date: yup.string().label('date').required(),
    description: yup.string().label('description').optional(),
  })
  .strict()

export const createAdjustmentSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup
      .number()
      .label('amount')
      .required()
      .test('nonzero', 'amount_nonzero', (value) => value !== 0),
    date: yup.string().label('date').required(),
    description: yup.string().label('description').optional(),
  })
  .strict()

export const updateTransferSchema = yup
  .object({
    amount: yup.number().label('amount').positive().optional(),
    date: yup.string().label('date').optional(),
    description: yup.string().label('description').nullable().optional(),
  })
  .strict()

export const updateAdjustmentSchema = yup
  .object({
    amount: yup
      .number()
      .label('amount')
      .optional()
      .test('nonzero', 'amount_nonzero', (value) => value === undefined || value !== 0),
    date: yup.string().label('date').optional(),
    description: yup.string().label('description').nullable().optional(),
  })
  .strict()

// Exchange = currency conversion. Source and destination accounts MAY be the
// same (intra-account), so there is no "different accounts" test; the currencies
// MUST differ.
export const createExchangeSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    currency_code: yup.string().label('currency_code').required().oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    transfer_destination_account_id: yup
      .string()
      .label('transfer_destination_account_id')
      .uuid()
      .required(),
    destination_currency: yup
      .string()
      .label('destination_currency')
      .required()
      .oneOf(SUPPORTED_CURRENCIES)
      .test('different-currency', 'destination_currency_same_as_source', function (value) {
        return value !== this.parent.currency_code
      }),
    destination_amount: yup.number().label('destination_amount').required().positive(),
    date: yup.string().label('date').required(),
    description: yup.string().label('description').optional(),
  })
  .strict()

export const updateExchangeSchema = yup
  .object({
    amount: yup.number().label('amount').positive().optional(),
    destination_amount: yup.number().label('destination_amount').positive().optional(),
    date: yup.string().label('date').optional(),
    description: yup.string().label('description').nullable().optional(),
  })
  .strict()

export type CreateIncomeInput = yup.InferType<typeof createIncomeSchema>
export type CreateExpenseInput = yup.InferType<typeof createExpenseSchema>
export type UpdateTransactionInput = yup.InferType<typeof updateTransactionSchema>
export type CreateTransferInput = yup.InferType<typeof createTransferSchema>
export type CreateAdjustmentInput = yup.InferType<typeof createAdjustmentSchema>
export type UpdateTransferInput = yup.InferType<typeof updateTransferSchema>
export type UpdateAdjustmentInput = yup.InferType<typeof updateAdjustmentSchema>
export type CreateExchangeInput = yup.InferType<typeof createExchangeSchema>
export type UpdateExchangeInput = yup.InferType<typeof updateExchangeSchema>
export type ReimbursementDeclarationInput = yup.InferType<typeof reimbursementDeclarationSchema>
export type ConfirmReimbursementInput = yup.InferType<typeof confirmReimbursementSchema>
export type CancelReimbursementInput = yup.InferType<typeof cancelReimbursementSchema>
