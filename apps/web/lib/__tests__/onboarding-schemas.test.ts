import { describe, expect, it } from 'vitest'
import { initialBalanceSchema } from '@grana/validation'

// UUIDs need to match the v1-v5 shape (version nibble = 1-5, variant nibble = 8/9/a/b).
const UUID_A = '11111111-1111-4111-8111-111111111111'

describe('initialBalanceSchema', () => {
  it('rejects missing primary_ars (required — no skip allowed)', async () => {
    await expect(
      initialBalanceSchema.validate({
        primary_account_id: UUID_A,
      }),
    ).rejects.toThrow()
  })

  it('accepts numeric amounts on primary (both currencies)', async () => {
    const data = await initialBalanceSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 100000,
      primary_usd: 250,
    })
    expect(data.primary_ars).toBe(100000)
    expect(data.primary_usd).toBe(250)
  })

  it('accepts primary_ars=0 explicitly (no money is a valid declaration)', async () => {
    const data = await initialBalanceSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 0,
    })
    expect(data.primary_ars).toBe(0)
  })

  it('rejects missing primary_account_id', async () => {
    await expect(initialBalanceSchema.validate({})).rejects.toThrow()
  })

  it('rejects non-uuid primary_account_id', async () => {
    await expect(
      initialBalanceSchema.validate({ primary_account_id: 'not-a-uuid' }),
    ).rejects.toThrow()
  })

  it('rejects negative amounts', async () => {
    await expect(
      initialBalanceSchema.validate({
        primary_account_id: UUID_A,
        primary_ars: -100,
      }),
    ).rejects.toThrow()
  })
})

/*
 * Note: empty-string handling for money inputs lives in the client form
 * (see InitialBalanceForm.parseAmountsOrFail) which converts '' -> undefined
 * before invoking the server action. The schema therefore expects
 * number | undefined and is not responsible for parsing user input.
 */
