import { describe, expect, it } from 'vitest'
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  sharedSplitSchema,
  settlementSchema,
  updateHouseholdConfigSchema,
} from '@grana/validation'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

describe('createHouseholdSchema', () => {
  it('accepts a non-empty name and trims it', () => {
    expect(createHouseholdSchema.cast({ name: '  Casa  ' })).toEqual({ name: 'Casa' })
    expect(createHouseholdSchema.isValidSync({ name: 'Casa' })).toBe(true)
  })

  it('rejects empty or too-long names', () => {
    expect(createHouseholdSchema.isValidSync({ name: '' })).toBe(false)
    expect(createHouseholdSchema.isValidSync({ name: 'x'.repeat(51) })).toBe(false)
  })
})

describe('joinHouseholdSchema', () => {
  it('accepts a code and uppercases it', () => {
    expect(joinHouseholdSchema.cast({ code: ' grana-k7p2 ' })).toEqual({ code: 'GRANA-K7P2' })
  })

  it('rejects an empty code', () => {
    expect(joinHouseholdSchema.isValidSync({ code: '' })).toBe(false)
  })
})

describe('sharedSplitSchema', () => {
  it('accepts a two-member split that sums to 100', () => {
    expect(
      sharedSplitSchema.isValidSync([
        { user_id: UUID_A, percentage: 60 },
        { user_id: UUID_B, percentage: 40 },
      ]),
    ).toBe(true)
  })

  it('rejects a split that does not sum to 100', () => {
    expect(
      sharedSplitSchema.isValidSync([
        { user_id: UUID_A, percentage: 60 },
        { user_id: UUID_B, percentage: 30 },
      ]),
    ).toBe(false)
  })

  it('accepts a 0/100 split (the expense is fully the other member’s)', () => {
    expect(
      sharedSplitSchema.isValidSync([
        { user_id: UUID_A, percentage: 0 },
        { user_id: UUID_B, percentage: 100 },
      ]),
    ).toBe(true)
  })

  it('rejects a percentage outside 0..100', () => {
    expect(
      sharedSplitSchema.isValidSync([
        { user_id: UUID_A, percentage: -10 },
        { user_id: UUID_B, percentage: 110 },
      ]),
    ).toBe(false)
  })
})

describe('updateHouseholdConfigSchema', () => {
  it('accepts a name-only update without a default split', async () => {
    // Regression: an optional `default_split` must not trip the splits-sum-100
    // test when it is absent (it runs on undefined), or a name-only update fails.
    await expect(updateHouseholdConfigSchema.validate({ name: 'Casa' })).resolves.toEqual({
      name: 'Casa',
    })
  })

  it('accepts a default-split-only update that sums to 100', () => {
    expect(
      updateHouseholdConfigSchema.isValidSync({
        default_split: [
          { user_id: UUID_A, percentage: 60 },
          { user_id: UUID_B, percentage: 40 },
        ],
      }),
    ).toBe(true)
  })

  it('rejects an empty name and a default split that does not sum to 100', () => {
    expect(updateHouseholdConfigSchema.isValidSync({ name: '' })).toBe(false)
    expect(
      updateHouseholdConfigSchema.isValidSync({
        default_split: [
          { user_id: UUID_A, percentage: 60 },
          { user_id: UUID_B, percentage: 30 },
        ],
      }),
    ).toBe(false)
  })

  it('rejects a default split with a 0% member (the default stays 1..99)', () => {
    // The 0/100 relaxation is a per-expense decision, not the household norm.
    expect(
      updateHouseholdConfigSchema.isValidSync({
        default_split: [
          { user_id: UUID_A, percentage: 0 },
          { user_id: UUID_B, percentage: 100 },
        ],
      }),
    ).toBe(false)
  })
})

describe('settlementSchema', () => {
  it('accepts a positive amount with a currency, account and date', () => {
    expect(
      settlementSchema.isValidSync({
        currency_code: 'ARS',
        amount: 14000,
        account_id: UUID_A,
        date: '2026-08-03',
      }),
    ).toBe(true)
  })

  it('rejects a non-positive amount and a missing account', () => {
    expect(
      settlementSchema.isValidSync({
        currency_code: 'ARS',
        amount: 0,
        account_id: UUID_A,
        date: '2026-08-03',
      }),
    ).toBe(false)
    expect(
      settlementSchema.isValidSync({ currency_code: 'ARS', amount: 14000, date: '2026-08-03' }),
    ).toBe(false)
  })

  it('rejects a missing date', () => {
    expect(
      settlementSchema.isValidSync({ currency_code: 'ARS', amount: 14000, account_id: UUID_A }),
    ).toBe(false)
  })
})
