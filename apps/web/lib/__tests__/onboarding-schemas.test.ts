import { describe, expect, it } from 'vitest'
import { perfilSchema, saldoActualSchema } from '@grana/validation'

// UUIDs need to match the v1-v5 shape (version nibble = 1-5, variant nibble = 8/9/a/b).
const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-9222-222222222222'

describe('perfilSchema', () => {
  it('accepts novato with no bank fields', async () => {
    const data = await perfilSchema.validate({ mode: 'novato' })
    expect(data.mode).toBe('novato')
    // has_bank_account default kicks in on cast(); validate() leaves it as
    // sent. Both undefined and false are acceptable here.
    expect(data.has_bank_account ?? false).toBe(false)
  })

  it('accepts experto without bank account', async () => {
    const data = await perfilSchema.validate({
      mode: 'experto',
      has_bank_account: false,
    })
    expect(data.mode).toBe('experto')
    expect(data.has_bank_account).toBe(false)
  })

  it('accepts experto with bank account fully filled', async () => {
    const data = await perfilSchema.validate({
      mode: 'experto',
      has_bank_account: true,
      institution_id: UUID_A,
      bank_account_name: 'Caja de ahorro',
    })
    expect(data.institution_id).toBe(UUID_A)
    expect(data.bank_account_name).toBe('Caja de ahorro')
  })

  it('rejects mode missing', async () => {
    await expect(perfilSchema.validate({})).rejects.toThrow()
  })

  it('rejects mode with invalid value', async () => {
    await expect(perfilSchema.validate({ mode: 'admin' })).rejects.toThrow()
  })

  it('rejects experto + has_bank_account but no institution_id', async () => {
    await expect(
      perfilSchema.validate({
        mode: 'experto',
        has_bank_account: true,
        bank_account_name: 'Caja',
      }),
    ).rejects.toThrow()
  })

  it('rejects experto + has_bank_account but empty bank_account_name', async () => {
    await expect(
      perfilSchema.validate({
        mode: 'experto',
        has_bank_account: true,
        institution_id: UUID_A,
        bank_account_name: '',
      }),
    ).rejects.toThrow()
  })

  it('does NOT require bank fields for novato + has_bank_account=true (defensive)', async () => {
    // Even if the form somehow sends has_bank_account=true with mode=novato,
    // the schema accepts it without bank fields because the .when() only
    // demands them when mode='experto'.
    const data = await perfilSchema.validate({
      mode: 'novato',
      has_bank_account: true,
    })
    expect(data.mode).toBe('novato')
  })
})

describe('saldoActualSchema', () => {
  it('rejects missing primary_ars (now required — no skip allowed)', async () => {
    await expect(
      saldoActualSchema.validate({
        primary_account_id: UUID_A,
      }),
    ).rejects.toThrow()
  })

  it('accepts numeric amounts on primary (both currencies)', async () => {
    const data = await saldoActualSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 100000,
      primary_usd: 250,
    })
    expect(data.primary_ars).toBe(100000)
    expect(data.primary_usd).toBe(250)
  })

  it('accepts primary_ars=0 explicitly (no money is a valid declaration)', async () => {
    const data = await saldoActualSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 0,
    })
    expect(data.primary_ars).toBe(0)
  })

  it('accepts secondary cash account with amounts', async () => {
    const data = await saldoActualSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 50000,
      cash_account_id: UUID_B,
      cash_ars: 10000,
    })
    expect(data.cash_account_id).toBe(UUID_B)
    expect(data.cash_ars).toBe(10000)
  })

  it('still accepts secondary cash blank (only primary_ars is required)', async () => {
    const data = await saldoActualSchema.validate({
      primary_account_id: UUID_A,
      primary_ars: 0,
    })
    expect(data.cash_account_id).toBeUndefined()
    expect(data.cash_ars).toBeUndefined()
  })

  it('rejects missing primary_account_id', async () => {
    await expect(saldoActualSchema.validate({})).rejects.toThrow()
  })

  it('rejects non-uuid primary_account_id', async () => {
    await expect(
      saldoActualSchema.validate({ primary_account_id: 'not-a-uuid' }),
    ).rejects.toThrow()
  })

  it('rejects negative amounts', async () => {
    await expect(
      saldoActualSchema.validate({
        primary_account_id: UUID_A,
        primary_ars: -100,
      }),
    ).rejects.toThrow()
  })
})

/*
 * Note: empty-string handling for money inputs lives in the client form
 * (see SaldoActualForm.parseAmountsOrFail) which converts '' -> undefined
 * before invoking the server action. The schema therefore expects
 * number | undefined and is not responsible for parsing user input.
 */
