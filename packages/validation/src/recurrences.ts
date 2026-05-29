import * as yup from 'yup'

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const
// The four named presets are accepted everywhere; `custom` is only accepted by
// the create/update/from-movement flows (suggestions always emit a preset).
const RECURRENCE_PRESET_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'annual',
] as const
const RECURRENCE_FREQUENCIES = [
  ...RECURRENCE_PRESET_FREQUENCIES,
  'custom',
] as const
const INTERVAL_UNITS = ['day', 'week', 'month', 'year'] as const

// Custom-frequency fields. Required only when `frequency === 'custom'`; ignored
// (derived from the preset) otherwise. `max_occurrences` is an optional cap on
// how many occurrences the rule produces, complementary to `end_date`.
const recurrenceIntervalFields = {
  interval_count: yup
    .number()
    .label('interval_count')
    .integer()
    .min(1)
    .when('frequency', {
      is: 'custom',
      then: (schema) => schema.required(),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  interval_unit: yup
    .string()
    .label('interval_unit')
    .oneOf(INTERVAL_UNITS)
    .when('frequency', {
      is: 'custom',
      then: (schema) => schema.required(),
      otherwise: (schema) => schema.nullable().optional(),
    }),
  max_occurrences: yup
    .number()
    .label('max_occurrences')
    .integer()
    .min(1)
    .nullable()
    .optional(),
}

const recurrenceBaseSchema = {
  account_id: yup.string().label('account_id').uuid().required(),
  currency_code: yup
    .string()
    .label('currency_code')
    .required()
    .oneOf(SUPPORTED_CURRENCIES),
  amount: yup.number().label('amount').required().positive(),
  description: yup.string().label('description').nullable().optional(),
  frequency: yup
    .string()
    .label('frequency')
    .required()
    .oneOf(RECURRENCE_FREQUENCIES),
  ...recurrenceIntervalFields,
  start_date: yup.string().label('start_date').required(),
  end_date: yup
    .string()
    .label('end_date')
    .nullable()
    .optional()
    .test('end-after-start', 'end_date_must_be_after_start_date', function (value) {
      const { start_date } = this.parent
      if (!value || !start_date) return true
      return value >= start_date
    }),
  created_from_transaction_id: yup
    .string()
    .label('created_from_transaction_id')
    .uuid()
    .nullable()
    .optional(),
}

const categorizedRecurrenceFields = {
  category_id: yup.string().label('category_id').uuid().required(),
  subcategory_id: yup.string().label('subcategory_id').uuid().nullable().optional(),
}

export const createIncomeRecurrenceSchema = yup
  .object({
    movement_type: yup.string().label('movement_type').required().oneOf(['income'] as const),
    ...recurrenceBaseSchema,
    ...categorizedRecurrenceFields,
  })
  .strict()

export const createExpenseRecurrenceSchema = yup
  .object({
    movement_type: yup.string().label('movement_type').required().oneOf(['expense'] as const),
    ...recurrenceBaseSchema,
    ...categorizedRecurrenceFields,
  })
  .strict()

export const createTransferRecurrenceSchema = yup
  .object({
    movement_type: yup.string().label('movement_type').required().oneOf(['transfer'] as const),
    ...recurrenceBaseSchema,
    transfer_destination_account_id: yup
      .string()
      .label('transfer_destination_account_id')
      .uuid()
      .required()
      .test('not-same-as-source', 'destination_same_as_source', function (value) {
        return value !== this.parent.account_id
      }),
  })
  .strict()

export const createRecurrenceSchema = yup.lazy((value) => {
  if (value && typeof value === 'object' && 'movement_type' in value) {
    const movementType = (value as { movement_type?: unknown }).movement_type
    if (movementType === 'income') return createIncomeRecurrenceSchema
    if (movementType === 'expense') return createExpenseRecurrenceSchema
    if (movementType === 'transfer') return createTransferRecurrenceSchema
  }
  return yup
    .object({
      movement_type: yup
        .string()
        .label('movement_type')
        .required()
        .oneOf(['income', 'expense', 'transfer'] as const),
    })
    .strict()
})

export const createRecurrenceFromMovementSchema = yup
  .object({
    transaction_id: yup.string().label('transaction_id').uuid().required(),
    frequency: yup
      .string()
      .label('frequency')
      .required()
      .oneOf(RECURRENCE_FREQUENCIES),
    ...recurrenceIntervalFields,
    end_date: yup.string().label('end_date').nullable().optional(),
  })
  .strict()

export const confirmRecurrenceInstanceSchema = yup
  .object({
    amount: yup.number().label('amount').positive().optional(),
    date: yup.string().label('date').optional(),
    description: yup.string().label('description').nullable().optional(),
    category_id: yup
      .string()
      .label('category_id')
      .uuid()
      .nullable()
      .optional(),
    subcategory_id: yup
      .string()
      .label('subcategory_id')
      .uuid()
      .nullable()
      .optional(),
    fx_rate_to_ars: yup
      .number()
      .label('fx_rate_to_ars')
      .positive()
      .nullable()
      .optional(),
  })
  .strict()

export const acceptRecurrenceSuggestionSchema = yup
  .object({
    movement_type: yup
      .string()
      .label('movement_type')
      .required()
      .oneOf(['income', 'expense', 'transfer'] as const),
    account_id: yup.string().label('account_id').uuid().required(),
    transfer_destination_account_id: yup
      .string()
      .label('transfer_destination_account_id')
      .uuid()
      .nullable()
      .optional(),
    category_id: yup
      .string()
      .label('category_id')
      .uuid()
      .nullable()
      .optional(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    frequency: yup
      .string()
      .label('frequency')
      .required()
      .oneOf(RECURRENCE_PRESET_FREQUENCIES),
    start_date: yup.string().label('start_date').required(),
    description: yup.string().label('description').nullable().optional(),
    fingerprint: yup.string().label('fingerprint').required(),
  })
  .strict()

export const dismissRecurrenceSuggestionSchema = yup
  .object({
    fingerprint: yup.string().label('fingerprint').required(),
  })
  .strict()

export const updateRecurrenceSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().optional(),
    transfer_destination_account_id: yup
      .string()
      .label('transfer_destination_account_id')
      .uuid()
      .nullable()
      .optional()
      .test('not-same-as-source', 'destination_same_as_source', function (value) {
        const accountId = this.parent.account_id
        if (!value || !accountId) return true
        return value !== accountId
      }),
    currency_code: yup
      .string()
      .label('currency_code')
      .optional()
      .oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').positive().optional(),
    category_id: yup.string().label('category_id').uuid().nullable().optional(),
    subcategory_id: yup.string().label('subcategory_id').uuid().nullable().optional(),
    description: yup.string().label('description').nullable().optional(),
    frequency: yup
      .string()
      .label('frequency')
      .optional()
      .oneOf(RECURRENCE_FREQUENCIES),
    ...recurrenceIntervalFields,
    start_date: yup.string().label('start_date').optional(),
    end_date: yup.string().label('end_date').nullable().optional(),
  })
  .strict()
  .test('end-after-start', 'end_date_must_be_after_start_date', function (value) {
    if (!value?.end_date || !value.start_date) return true
    return value.end_date >= value.start_date
  })

export type CreateIncomeRecurrenceInput = yup.InferType<
  typeof createIncomeRecurrenceSchema
>
export type CreateExpenseRecurrenceInput = yup.InferType<
  typeof createExpenseRecurrenceSchema
>
export type CreateTransferRecurrenceInput = yup.InferType<
  typeof createTransferRecurrenceSchema
>
export type CreateRecurrenceInput =
  | CreateIncomeRecurrenceInput
  | CreateExpenseRecurrenceInput
  | CreateTransferRecurrenceInput
export type CreateRecurrenceFromMovementInput = yup.InferType<
  typeof createRecurrenceFromMovementSchema
>
export type ConfirmRecurrenceInstanceInput = yup.InferType<
  typeof confirmRecurrenceInstanceSchema
>
export type AcceptRecurrenceSuggestionInput = yup.InferType<
  typeof acceptRecurrenceSuggestionSchema
>
export type DismissRecurrenceSuggestionInput = yup.InferType<
  typeof dismissRecurrenceSuggestionSchema
>
export type UpdateRecurrenceInput = yup.InferType<typeof updateRecurrenceSchema>
