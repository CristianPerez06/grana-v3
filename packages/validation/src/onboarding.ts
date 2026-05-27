import * as yup from 'yup'

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

export const initialBalanceSchema = yup
  .object({
    primary_account_id: yup
      .string()
      .label('primary_account_id')
      .uuid()
      .required(),
    primary_ars: requiredMoneyAmount,
    primary_usd: optionalMoneyAmount,
  })
  .strict()

export type InitialBalanceInput = yup.InferType<typeof initialBalanceSchema>
