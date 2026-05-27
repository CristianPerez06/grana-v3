import { describe, expect, it } from 'vitest'
import { createAccountSchema, updateAccountSchema } from '@grana/validation'

const validCash = {
  name: 'Billetera',
  type: 'cash' as const,
  currencies: [{ currency_code: 'ARS' as const, initial_balance: 0 }],
}

describe('createAccountSchema avatar keys', () => {
  it('accepts a valid color_key and icon_key', async () => {
    await expect(
      createAccountSchema.validate({ ...validCash, color_key: 'violet', icon_key: 'piggy-bank' }),
    ).resolves.toBeTruthy()
  })

  it('accepts absence of avatar keys (NULL = auto)', async () => {
    await expect(createAccountSchema.validate(validCash)).resolves.toBeTruthy()
  })

  it('accepts null avatar keys', async () => {
    await expect(
      createAccountSchema.validate({ ...validCash, color_key: null, icon_key: null }),
    ).resolves.toBeTruthy()
  })

  it('rejects a color_key outside the registry', async () => {
    await expect(
      createAccountSchema.validate({ ...validCash, color_key: 'chartreuse' }),
    ).rejects.toThrow()
  })

  it('rejects an icon_key outside the registry', async () => {
    await expect(
      createAccountSchema.validate({ ...validCash, icon_key: 'spaceship' }),
    ).rejects.toThrow()
  })
})

describe('updateAccountSchema avatar keys', () => {
  it('accepts a valid avatar override', async () => {
    await expect(
      updateAccountSchema.validate({ color_key: 'teal', icon_key: 'briefcase' }),
    ).resolves.toBeTruthy()
  })

  it('rejects an invalid icon_key', async () => {
    await expect(updateAccountSchema.validate({ icon_key: 'rocket' })).rejects.toThrow()
  })
})
