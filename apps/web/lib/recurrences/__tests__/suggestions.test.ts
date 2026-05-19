import { describe, expect, it } from 'vitest'
import {
  detectRecurrenceSuggestions,
  type SuggestionMovement,
} from '../suggestions'

const ACCOUNT_A = '11111111-1111-1111-1111-111111111111'
const ACCOUNT_B = '22222222-2222-2222-2222-222222222222'
const CATEGORY_X = '33333333-3333-3333-3333-333333333333'
const CATEGORY_Y = '44444444-4444-4444-4444-444444444444'

function makeMovement(
  overrides: Partial<SuggestionMovement> & { date: string },
): SuggestionMovement {
  return {
    id: overrides.date + Math.random(),
    type: 'expense',
    account_id: ACCOUNT_A,
    destination_account_id: null,
    category_id: CATEGORY_X,
    currency_code: 'ARS',
    amount: 10000,
    description: null,
    ...overrides,
  }
}

describe('detectRecurrenceSuggestions', () => {
  it('returns empty when there are fewer than 3 movements', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-04-01' }),
        makeMovement({ date: '2026-05-01' }),
      ],
      new Set(),
      [],
    )
    expect(result).toEqual([])
  })

  it('detects a monthly pattern with 3+ consistent gaps', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15', amount: 10000 }),
        makeMovement({ date: '2026-03-15', amount: 10500 }),
        makeMovement({ date: '2026-04-15', amount: 11000 }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].frequency).toBe('monthly')
    expect(result[0].account_id).toBe(ACCOUNT_A)
    expect(result[0].category_id).toBe(CATEGORY_X)
    expect(result[0].currency_code).toBe('ARS')
    expect(result[0].amount).toBe(10500) // median
    expect(result[0].occurrence_count).toBe(3)
    expect(result[0].start_date).toBe('2026-04-15')
  })

  it('detects a weekly pattern', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-04-01' }),
        makeMovement({ date: '2026-04-08' }),
        makeMovement({ date: '2026-04-15' }),
        makeMovement({ date: '2026-04-22' }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].frequency).toBe('weekly')
    expect(result[0].occurrence_count).toBe(4)
  })

  it('detects a biweekly pattern', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-03-01' }),
        makeMovement({ date: '2026-03-15' }),
        makeMovement({ date: '2026-03-29' }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].frequency).toBe('biweekly')
  })

  it('ignores patterns whose gaps do not match any frequency', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-04-01' }),
        makeMovement({ date: '2026-04-04' }),
        makeMovement({ date: '2026-04-10' }),
      ],
      new Set(),
      [],
    )
    expect(result).toEqual([])
  })

  it('uses the median as the proposed amount (resistant to outliers)', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15', amount: 10000 }),
        makeMovement({ date: '2026-03-15', amount: 12000 }),
        makeMovement({ date: '2026-04-15', amount: 999999 }),
      ],
      new Set(),
      [],
    )
    expect(result[0].amount).toBe(12000)
  })

  it('uses the most recent description as the suggested one', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15', description: 'Sueldo viejo' }),
        makeMovement({ date: '2026-03-15', description: null }),
        makeMovement({ date: '2026-04-15', description: 'Sueldo Abril' }),
      ],
      new Set(),
      [],
    )
    expect(result[0].description).toBe('Sueldo Abril')
  })

  it('groups movements by account+category+currency stream', () => {
    const result = detectRecurrenceSuggestions(
      [
        // Stream 1: monthly on (ACCOUNT_A, CATEGORY_X)
        makeMovement({ date: '2026-02-01', category_id: CATEGORY_X }),
        makeMovement({ date: '2026-03-01', category_id: CATEGORY_X }),
        makeMovement({ date: '2026-04-01', category_id: CATEGORY_X }),
        // Stream 2: monthly on (ACCOUNT_A, CATEGORY_Y)
        makeMovement({ date: '2026-02-10', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-03-10', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-04-10', category_id: CATEGORY_Y }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(2)
    const categories = result.map((s) => s.category_id).sort()
    expect(categories).toEqual([CATEGORY_X, CATEGORY_Y].sort())
  })

  it('separates streams by currency', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15', currency_code: 'ARS' }),
        makeMovement({ date: '2026-03-15', currency_code: 'ARS' }),
        makeMovement({ date: '2026-04-15', currency_code: 'ARS' }),
        makeMovement({ date: '2026-02-15', currency_code: 'USD' }),
        makeMovement({ date: '2026-03-15', currency_code: 'USD' }),
        makeMovement({ date: '2026-04-15', currency_code: 'USD' }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(2)
    expect(new Set(result.map((s) => s.currency_code))).toEqual(
      new Set(['ARS', 'USD']),
    )
  })

  // Test 6.10 from tasks.md: dismissed suggestion does not reappear for the
  // same fingerprint. The algorithm filters out dismissed fingerprints; the
  // DB-side UNIQUE(user_id, fingerprint) on recurrence_suggestion_dismissals
  // is the backstop (covered in migration.test.ts).
  it('excludes streams whose fingerprint was dismissed', () => {
    const movements = [
      makeMovement({ date: '2026-02-15' }),
      makeMovement({ date: '2026-03-15' }),
      makeMovement({ date: '2026-04-15' }),
    ]
    const firstPass = detectRecurrenceSuggestions(movements, new Set(), [])
    const fingerprint = firstPass[0].fingerprint

    const secondPass = detectRecurrenceSuggestions(
      movements,
      new Set([fingerprint]),
      [],
    )
    expect(secondPass).toEqual([])
  })

  it('excludes streams that already have an active rule', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15' }),
        makeMovement({ date: '2026-03-15' }),
        makeMovement({ date: '2026-04-15' }),
      ],
      new Set(),
      [
        {
          movement_type: 'expense',
          account_id: ACCOUNT_A,
          destination_account_id: null,
          category_id: CATEGORY_X,
          currency_code: 'ARS',
        },
      ],
    )
    expect(result).toEqual([])
  })

  it('sorts suggestions by occurrence count (more frequent first)', () => {
    const result = detectRecurrenceSuggestions(
      [
        // Stream X: 3 occurrences
        makeMovement({ date: '2026-02-15', category_id: CATEGORY_X }),
        makeMovement({ date: '2026-03-15', category_id: CATEGORY_X }),
        makeMovement({ date: '2026-04-15', category_id: CATEGORY_X }),
        // Stream Y: 5 occurrences (weekly)
        makeMovement({ date: '2026-04-01', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-04-08', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-04-15', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-04-22', category_id: CATEGORY_Y }),
        makeMovement({ date: '2026-04-29', category_id: CATEGORY_Y }),
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(2)
    expect(result[0].category_id).toBe(CATEGORY_Y) // 5 occurrences first
    expect(result[1].category_id).toBe(CATEGORY_X)
  })

  it('detects transfer streams via destination account, not category', () => {
    const result = detectRecurrenceSuggestions(
      [
        {
          id: '1',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: ACCOUNT_B,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-02-15',
          description: null,
        },
        {
          id: '2',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: ACCOUNT_B,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-03-15',
          description: null,
        },
        {
          id: '3',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: ACCOUNT_B,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-04-15',
          description: null,
        },
      ],
      new Set(),
      [],
    )
    expect(result).toHaveLength(1)
    expect(result[0].movement_type).toBe('transfer')
    expect(result[0].destination_account_id).toBe(ACCOUNT_B)
    expect(result[0].frequency).toBe('monthly')
  })

  it('skips income/expense movements without category_id', () => {
    const result = detectRecurrenceSuggestions(
      [
        makeMovement({ date: '2026-02-15', category_id: null }),
        makeMovement({ date: '2026-03-15', category_id: null }),
        makeMovement({ date: '2026-04-15', category_id: null }),
      ],
      new Set(),
      [],
    )
    expect(result).toEqual([])
  })

  it('skips transfers without destination_account_id', () => {
    const result = detectRecurrenceSuggestions(
      [
        {
          id: '1',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: null,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-02-15',
          description: null,
        },
        {
          id: '2',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: null,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-03-15',
          description: null,
        },
        {
          id: '3',
          type: 'transfer',
          account_id: ACCOUNT_A,
          destination_account_id: null,
          category_id: null,
          currency_code: 'ARS',
          amount: 50000,
          date: '2026-04-15',
          description: null,
        },
      ],
      new Set(),
      [],
    )
    expect(result).toEqual([])
  })
})
