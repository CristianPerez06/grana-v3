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

export type CreateIncomeInput = yup.InferType<typeof createIncomeSchema>
export type CreateExpenseInput = yup.InferType<typeof createExpenseSchema>
export type UpdateTransactionInput = yup.InferType<typeof updateTransactionSchema>
