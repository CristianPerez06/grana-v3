import { describe, expect, it } from 'vitest'
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  sharedSplitSchema,
  settlementSchema,
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

  it('rejects a percentage below 1', () => {
    expect(
      sharedSplitSchema.isValidSync([
        { user_id: UUID_A, percentage: 0 },
        { user_id: UUID_B, percentage: 100 },
      ]),
    ).toBe(false)
  })
})

describe('settlementSchema', () => {
  it('accepts a positive amount with a currency and account', () => {
    expect(
      settlementSchema.isValidSync({ currency_code: 'ARS', amount: 14000, account_id: UUID_A }),
    ).toBe(true)
  })

  it('rejects a non-positive amount and a missing account', () => {
    expect(
      settlementSchema.isValidSync({ currency_code: 'ARS', amount: 0, account_id: UUID_A }),
    ).toBe(false)
    expect(settlementSchema.isValidSync({ currency_code: 'ARS', amount: 14000 })).toBe(false)
  })
})
