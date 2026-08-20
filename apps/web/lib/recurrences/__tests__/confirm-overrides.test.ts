import { describe, expect, it } from 'vitest'
import { confirmRecurrenceInstanceSchema } from '@grana/validation'

// Change edit-recurrence-instance-account: the confirmation payload accepts a
// per-instance account override ("this month I paid it with another card").
// Absent means "confirm on the instance's own account" — the rule is never
// rewritten either way, that part is enforced in confirmRecurrenceInstance.

const ACCOUNT = '11111111-1111-4111-8111-111111111111'

describe('confirmRecurrenceInstanceSchema — account override', () => {
  it('accepts an account_id', async () => {
    const value = await confirmRecurrenceInstanceSchema.validate({
      account_id: ACCOUNT,
    })
    expect(value.account_id).toBe(ACCOUNT)
  })

  it('stays valid with no overrides at all', async () => {
    const value = await confirmRecurrenceInstanceSchema.validate({})
    expect(value.account_id).toBeUndefined()
  })

  it('rejects an account_id that is not a uuid', async () => {
    await expect(
      confirmRecurrenceInstanceSchema.validate({ account_id: 'la-visa' }),
    ).rejects.toThrow()
  })

  it('keeps accepting the amount + date + description overrides', async () => {
    const value = await confirmRecurrenceInstanceSchema.validate({
      amount: 42000,
      date: '2026-08-20',
      description: 'Luz agosto',
      account_id: ACCOUNT,
    })
    expect(value).toMatchObject({
      amount: 42000,
      date: '2026-08-20',
      description: 'Luz agosto',
      account_id: ACCOUNT,
    })
  })
})
