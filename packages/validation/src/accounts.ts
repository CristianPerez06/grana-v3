import * as yup from 'yup'

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

const currencySchema = yup
  .object({
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    initial_balance: yup
      .number()
      .label('initial_balance')
      .required()
      .min(0),
  })
  .strict()

export const createAccountSchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .required()
      .min(1)
      .max(50),
    type: yup
      .string()
      .label('type')
      .required()
      .oneOf(['cash', 'bank'] as const),
    institution_id: yup
      .string()
      .label('institution_id')
      .uuid()
      .nullable()
      .optional()
      .when('type', {
        is: 'bank',
        then: (s) => s.required(),
        otherwise: (s) => s.nullable().optional(),
      }),
    currencies: yup
      .array(currencySchema)
      .label('currencies')
      .required()
      .min(1),
  })
  .strict()

export const updateAccountSchema = yup
  .object({
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(1)
      .max(50)
      .optional(),
    institution_id: yup
      .string()
      .label('institution_id')
      .uuid()
      .nullable()
      .optional(),
  })
  .strict()

export const addCurrencySchema = yup
  .object({
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    initial_balance: yup
      .number()
      .label('initial_balance')
      .required()
      .min(0),
  })
  .strict()

export type CreateAccountInput = yup.InferType<typeof createAccountSchema>
export type UpdateAccountInput = yup.InferType<typeof updateAccountSchema>
export type AddCurrencyInput = yup.InferType<typeof addCurrencySchema>
