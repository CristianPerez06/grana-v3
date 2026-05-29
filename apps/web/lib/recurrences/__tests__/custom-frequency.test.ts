import { describe, expect, it } from 'vitest'
import {
  addInterval,
  decideRecurrenceInstance,
  presetToInterval,
  type RuleForDecision,
} from '@grana/money-logic'
import {
  createIncomeRecurrenceSchema,
  createRecurrenceFromMovementSchema,
  updateRecurrenceSchema,
} from '@grana/validation'

// ── addInterval ───────────────────────────────────────────────────────────────
describe('addInterval', () => {
  it('adds days', () => {
    expect(addInterval('2026-05-01', 'day', 10)).toBe('2026-05-11')
  })

  it('adds weeks as 7-day steps', () => {
    expect(addInterval('2026-05-01', 'week', 2)).toBe('2026-05-15')
  })

  it('clamps end-of-month when adding months', () => {
    expect(addInterval('2026-01-31', 'month', 1)).toBe('2026-02-28')
    expect(addInterval('2026-01-31', 'month', 3)).toBe('2026-04-30')
  })

  it('clamps Feb 29 when adding years on non-leap targets', () => {
    expect(addInterval('2024-02-29', 'year', 1)).toBe('2025-02-28')
  })
})

// ── presetToInterval ────────────────────────────────────────────────────────
describe('presetToInterval', () => {
  it('maps each preset to its interval', () => {
    expect(presetToInterval('weekly')).toEqual({ count: 1, unit: 'week' })
    expect(presetToInterval('biweekly')).toEqual({ count: 2, unit: 'week' })
    expect(presetToInterval('monthly')).toEqual({ count: 1, unit: 'month' })
    expect(presetToInterval('annual')).toEqual({ count: 1, unit: 'year' })
  })
})

// ── decideRecurrenceInstance with custom interval + max_occurrences ──────────
function customRule(overrides: Partial<RuleForDecision> = {}): RuleForDecision {
  return {
    start_date: '2026-05-01',
    end_date: null,
    last_generated_date: '2026-05-01',
    interval_count: 3,
    interval_unit: 'month',
    max_occurrences: null,
    ...overrides,
  }
}

describe('decideRecurrenceInstance — custom interval', () => {
  it('uses interval_count/interval_unit when provided', () => {
    // every 10 days from 2026-05-01 → 2026-05-11
    const decision = decideRecurrenceInstance(
      customRule({ interval_count: 10, interval_unit: 'day' }),
      '2026-05-15',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-05-11' })
  })

  it('clamps end-of-month for custom monthly intervals', () => {
    const decision = decideRecurrenceInstance(
      customRule({
        start_date: '2026-01-31',
        last_generated_date: '2026-01-31',
        interval_count: 1,
        interval_unit: 'month',
      }),
      '2026-03-01',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-28' })
  })

  it('stops generating once max_occurrences is reached', () => {
    const decision = decideRecurrenceInstance(
      customRule({ max_occurrences: 3 }),
      '2027-01-01',
      false,
      3, // already materialized 3 instances
    )
    expect(decision).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })

  it('still generates while under max_occurrences', () => {
    const decision = decideRecurrenceInstance(
      customRule({ max_occurrences: 5 }),
      '2027-01-01',
      false,
      4,
    )
    expect(decision.generate).toBe(true)
  })

  it('has_pending takes precedence over max_occurrences', () => {
    const decision = decideRecurrenceInstance(
      customRule({ max_occurrences: 1 }),
      '2027-01-01',
      true,
      5,
    )
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })
})

// ── validation schema ─────────────────────────────────────────────────────────
describe('recurrence schemas — custom frequency', () => {
  const baseFromMovement = {
    transaction_id: '11111111-1111-4111-8111-111111111111',
  }

  it('accepts a preset without interval fields', async () => {
    await expect(
      createRecurrenceFromMovementSchema.validate({
        ...baseFromMovement,
        frequency: 'monthly',
      }),
    ).resolves.toBeDefined()
  })

  it('requires interval_count and interval_unit when frequency is custom', async () => {
    await expect(
      createRecurrenceFromMovementSchema.validate({
        ...baseFromMovement,
        frequency: 'custom',
      }),
    ).rejects.toBeTruthy()
  })

  it('accepts a valid custom interval', async () => {
    await expect(
      createRecurrenceFromMovementSchema.validate({
        ...baseFromMovement,
        frequency: 'custom',
        interval_count: 3,
        interval_unit: 'month',
        max_occurrences: 6,
      }),
    ).resolves.toMatchObject({ frequency: 'custom', interval_count: 3 })
  })

  it('rejects max_occurrences below 1', async () => {
    await expect(
      createRecurrenceFromMovementSchema.validate({
        ...baseFromMovement,
        frequency: 'monthly',
        max_occurrences: 0,
      }),
    ).rejects.toBeTruthy()
  })

  it('rejects a non-integer interval_count', async () => {
    await expect(
      createRecurrenceFromMovementSchema.validate({
        ...baseFromMovement,
        frequency: 'custom',
        interval_count: 2.5,
        interval_unit: 'week',
      }),
    ).rejects.toBeTruthy()
  })

  it('accepts custom on a full create income recurrence', async () => {
    await expect(
      createIncomeRecurrenceSchema.validate({
        movement_type: 'income',
        account_id: '22222222-2222-4222-8222-222222222222',
        currency_code: 'ARS',
        amount: 1000,
        frequency: 'custom',
        interval_count: 2,
        interval_unit: 'week',
        start_date: '2026-05-01',
        category_id: '33333333-3333-4333-8333-333333333333',
      }),
    ).resolves.toBeDefined()
  })

  it('allows updating to a custom interval', async () => {
    await expect(
      updateRecurrenceSchema.validate({
        frequency: 'custom',
        interval_count: 4,
        interval_unit: 'day',
      }),
    ).resolves.toMatchObject({ frequency: 'custom', interval_count: 4 })
  })
})
