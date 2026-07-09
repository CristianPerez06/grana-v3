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

// Per-expense split entry: a member may be 0% (the expense is fully the other
// member's — the payer fronted it), so the range is relaxed to 0..100.
const splitEntrySchema = yup
  .object({
    user_id: yup.string().label('user_id').uuid().required(),
    percentage: yup.number().label('percentage').required().integer().min(0).max(100),
  })
  .strict()

// Default (household) split entry: NOT part of the 0/100 relaxation. The default
// split is the household's norm, not a per-expense decision, so each member stays
// 1..99 (see the shared spec: the default-split editor is bounded to 1..99).
const defaultSplitEntrySchema = yup
  .object({
    user_id: yup.string().label('user_id').uuid().required(),
    percentage: yup.number().label('percentage').required().integer().min(1).max(99),
  })
  .strict()

// Presence is enforced by `.required()` / `.optional()`; the sum test only runs
// when a split is actually provided. Returning false on an absent value would make
// an optional `default_split` (e.g. a name-only `updateHouseholdConfig`) fail
// spuriously, since yup runs tests on undefined.
const sumsTo100 = (arr: { percentage?: number }[] | undefined): boolean => {
  if (!arr) return true
  return arr.reduce((acc, s) => acc + (s.percentage ?? 0), 0) === 100
}

// A split must list every member and the percentages must sum to 100. `.min(2)` +
// the sum test still reject degenerate splits.
export const sharedSplitSchema = yup
  .array(splitEntrySchema)
  .label('splits')
  .required()
  .min(2)
  .test('splits-sum-100', 'los porcentajes deben sumar 100', sumsTo100)

// The household default split: same shape, but each member bounded to 1..99.
export const defaultSplitSchema = yup
  .array(defaultSplitEntrySchema)
  .label('splits')
  .required()
  .min(2)
  .test('splits-sum-100', 'los porcentajes deben sumar 100', sumsTo100)

export const sharedExpenseSchema = yup
  .object({
    household_id: yup.string().label('household_id').uuid().required(),
    splits: sharedSplitSchema,
  })
  .strict()

export const updateHouseholdConfigSchema = yup
  .object({
    name: yup.string().label('name').transform(trim).min(1).max(50).optional(),
    default_split: defaultSplitSchema.optional().default(undefined),
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
