import * as yup from 'yup'

const MODE_VALUES = ['novato', 'experto'] as const

export const perfilSchema = yup
  .object({
    mode: yup
      .string()
      .label('mode')
      .required()
      .oneOf(MODE_VALUES),
    has_bank_account: yup
      .boolean()
      .label('has_bank_account')
      .default(false),
    institution_id: yup
      .string()
      .label('institution_id')
      .uuid()
      .nullable()
      .when(['mode', 'has_bank_account'], {
        is: (mode: string, has: boolean) => mode === 'experto' && has === true,
        then: (s) => s.required(),
        otherwise: (s) => s.nullable().optional(),
      }),
    bank_account_name: yup
      .string()
      .label('bank_account_name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .when(['mode', 'has_bank_account'], {
        is: (mode: string, has: boolean) => mode === 'experto' && has === true,
        then: (s) => s.required().min(1).max(50),
        otherwise: (s) => s.optional().nullable(),
      }),
  })
  .strict()

const optionalMoneyAmount = yup
  .number()
  .label('amount')
  .transform((value, original) => {
    if (original === '' || original === null || original === undefined) return undefined
    return value
  })
  .typeError('amount must be a number')
  .min(0)
  .optional()

const requiredMoneyAmount = yup
  .number()
  .label('amount')
  .transform((value, original) => {
    if (original === '' || original === null || original === undefined) return undefined
    return value
  })
  .typeError('amount must be a number')
  .min(0)
  .required()

export const saldoActualSchema = yup
  .object({
    primary_account_id: yup
      .string()
      .label('primary_account_id')
      .uuid()
      .required(),
    primary_ars: requiredMoneyAmount,
    primary_usd: optionalMoneyAmount,
    cash_account_id: yup
      .string()
      .label('cash_account_id')
      .uuid()
      .nullable()
      .optional(),
    cash_ars: optionalMoneyAmount,
    cash_usd: optionalMoneyAmount,
  })
  .strict()

export type PerfilInput = yup.InferType<typeof perfilSchema>
export type SaldoActualInput = yup.InferType<typeof saldoActualSchema>
