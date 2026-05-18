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
    category_id: yup.string().label('category_id').uuid().optional(),
    subcategory_id: yup.string().label('subcategory_id').uuid().optional(),
    description: yup.string().label('description').optional(),
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

export type CreateIncomeInput = yup.InferType<typeof createIncomeSchema>
export type CreateExpenseInput = yup.InferType<typeof createExpenseSchema>
export type UpdateTransactionInput = yup.InferType<typeof updateTransactionSchema>
export type CreateTransferInput = yup.InferType<typeof createTransferSchema>
export type CreateAdjustmentInput = yup.InferType<typeof createAdjustmentSchema>
export type UpdateTransferInput = yup.InferType<typeof updateTransferSchema>
export type UpdateAdjustmentInput = yup.InferType<typeof updateAdjustmentSchema>
