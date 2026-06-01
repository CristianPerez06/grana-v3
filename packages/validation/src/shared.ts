import * as yup from 'yup'

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v)
const trimUpper = (v: unknown) => (typeof v === 'string' ? v.trim().toUpperCase() : v)

// ─── Household lifecycle ─────────────────────────────────────────────────────

export const createHouseholdSchema = yup
  .object({
    name: yup.string().label('name').transform(trim).required().min(1).max(50),
  })
  .strict()

export const joinHouseholdSchema = yup
  .object({
    code: yup.string().label('code').transform(trimUpper).required().min(1),
  })
  .strict()

// ─── Splits (shared expense / default split) ─────────────────────────────────

const splitEntrySchema = yup
  .object({
    user_id: yup.string().label('user_id').uuid().required(),
    percentage: yup.number().label('percentage').required().integer().min(1).max(100),
  })
  .strict()

// A split must list every member, each ≥ 1%, and the percentages must sum to 100.
export const sharedSplitSchema = yup
  .array(splitEntrySchema)
  .label('splits')
  .required()
  .min(2)
  .test('splits-sum-100', 'los porcentajes deben sumar 100', (arr) => {
    if (!arr) return false
    const sum = arr.reduce((acc, s) => acc + (s.percentage ?? 0), 0)
    return sum === 100
  })

export const sharedExpenseSchema = yup
  .object({
    household_id: yup.string().label('household_id').uuid().required(),
    splits: sharedSplitSchema,
  })
  .strict()

export const updateHouseholdConfigSchema = yup
  .object({
    name: yup.string().label('name').transform(trim).min(1).max(50).optional(),
    default_split: sharedSplitSchema.optional().default(undefined),
  })
  .strict()

// ─── Settlement (saldar deuda) ───────────────────────────────────────────────

// Register a payment toward the debt. `amount` ≤ current debt is enforced in the
// action (it needs the derived debt); here we only guard shape and positivity.
export const settlementSchema = yup
  .object({
    currency_code: yup.string().label('currency_code').required().oneOf(SUPPORTED_CURRENCIES),
    amount: yup.number().label('amount').required().positive(),
    account_id: yup.string().label('account_id').uuid().required(),
  })
  .strict()

// Receiver assigns the account where the settlement landed.
export const assignSettlementSchema = yup
  .object({
    settlement_id: yup.string().label('settlement_id').uuid().required(),
    account_id: yup.string().label('account_id').uuid().required(),
  })
  .strict()

export type CreateHouseholdInput = yup.InferType<typeof createHouseholdSchema>
export type JoinHouseholdInput = yup.InferType<typeof joinHouseholdSchema>
export type SharedSplitInput = yup.InferType<typeof sharedSplitSchema>
export type SharedExpenseInput = yup.InferType<typeof sharedExpenseSchema>
export type UpdateHouseholdConfigInput = yup.InferType<typeof updateHouseholdConfigSchema>
export type SettlementInput = yup.InferType<typeof settlementSchema>
export type AssignSettlementInput = yup.InferType<typeof assignSettlementSchema>
