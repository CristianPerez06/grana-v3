import { describe, expect, it } from 'vitest'
import { createExpenseRecurrenceSchema } from '@grana/validation'

// Validation contract for shared recurrences (change add-shared-recurrences):
// only the expense schema accepts a `shared` template, and the split must be a
// valid two-member spec summing to 100. Income/transfer reject `shared`.

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const CATEGORY = '22222222-2222-4222-8222-222222222222'
const HOUSEHOLD = '33333333-3333-4333-8333-333333333333'
const U1 = '44444444-4444-4444-8444-444444444444'
const U2 = '55555555-5555-4555-8555-555555555555'

const baseExpense = {
  movement_type: 'expense' as const,
  account_id: ACCOUNT,
  currency_code: 'ARS' as const,
  amount: 100000,
  category_id: CATEGORY,
  frequency: 'monthly' as const,
  start_date: '2026-07-01',
}

describe('createExpenseRecurrenceSchema — shared', () => {
  it('accepts a valid 50·50 shared expense recurrence', async () => {
    const value = await createExpenseRecurrenceSchema.validate({
      ...baseExpense,
      shared: {
        household_id: HOUSEHOLD,
        splits: [
          { user_id: U1, percentage: 50 },
          { user_id: U2, percentage: 50 },
        ],
      },
    })
    expect(value.shared?.household_id).toBe(HOUSEHOLD)
  })

  it('rejects a shared split whose percentages do not sum to 100', async () => {
    await expect(
      createExpenseRecurrenceSchema.validate({
        ...baseExpense,
        shared: {
          household_id: HOUSEHOLD,
          splits: [
            { user_id: U1, percentage: 60 },
            { user_id: U2, percentage: 30 },
          ],
        },
      }),
    ).rejects.toThrow()
  })

  it('still accepts an individual expense recurrence (no shared field)', async () => {
    const value = await createExpenseRecurrenceSchema.validate(baseExpense)
    expect(value.shared).toBeUndefined()
  })

  // Income/transfer being out of scope is NOT a schema-level guarantee: yup's
  // `.strict()` disables stripUnknown, so a stray `shared` survives validation.
  // The real guarantee is layered — the income/transfer TS types omit `shared`,
  // `createRecurrence` only reads `data.shared` for expenses, and the DB
  // constraint `chk_recurrences_shared_expense_only` (see migration test) rejects
  // a household on a non-expense rule.
})
