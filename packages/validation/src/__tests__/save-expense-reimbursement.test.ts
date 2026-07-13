import { describe, it, expect } from 'vitest'
import { saveExpenseReimbursementSchema } from '../transactions'

const EXPENSE = '11111111-1111-4111-8111-111111111111'
const ACCOUNT = '22222222-2222-4222-8222-222222222222'
const HOUSEHOLD = '33333333-3333-4333-8333-333333333333'
const U1 = '44444444-4444-4444-8444-444444444444'
const U2 = '55555555-5555-4555-8555-555555555555'

const validate = (input: unknown) => saveExpenseReimbursementSchema.validate(input, { strict: true })

describe('saveExpenseReimbursementSchema', () => {
  it('accepts a bare remove (only expense_id, no reimbursement)', async () => {
    const parsed = await validate({ expense_id: EXPENSE })
    expect(parsed.expense_id).toBe(EXPENSE)
    expect(parsed.reimbursement).toBeUndefined()
  })

  it('accepts adding a pending account reimbursement', async () => {
    const parsed = await validate({
      expense_id: EXPENSE,
      reimbursement: {
        target: 'account',
        estimated_amount: 1000,
        account_id: ACCOUNT,
        received_now: false,
      },
    })
    expect(parsed.reimbursement?.target).toBe('account')
  })

  it('rejects a non-positive estimated amount', async () => {
    await expect(
      validate({
        expense_id: EXPENSE,
        reimbursement: { target: 'account', estimated_amount: 0, account_id: ACCOUNT },
      }),
    ).rejects.toThrow()
  })

  it('rejects an invalid target', async () => {
    await expect(
      validate({
        expense_id: EXPENSE,
        reimbursement: { target: 'wallet', estimated_amount: 500, account_id: ACCOUNT },
      }),
    ).rejects.toThrow()
  })

  it('requires a uuid expense_id', async () => {
    await expect(validate({ expense_id: 'not-a-uuid' })).rejects.toThrow()
  })

  it('carries a shared split so the reimbursement can inherit it', async () => {
    const parsed = await validate({
      expense_id: EXPENSE,
      reimbursement: { target: 'account', estimated_amount: 800, account_id: ACCOUNT },
      shared: {
        household_id: HOUSEHOLD,
        splits: [
          { user_id: U1, percentage: 60 },
          { user_id: U2, percentage: 40 },
        ],
      },
    })
    expect(parsed.shared?.household_id).toBe(HOUSEHOLD)
  })
})
