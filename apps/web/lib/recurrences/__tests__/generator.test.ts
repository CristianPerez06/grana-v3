import { describe, expect, it } from 'vitest'
import {
  decideRecurrenceInstance,
  type RuleForDecision,
} from '../generator'

function makeRule(overrides: Partial<RuleForDecision> = {}): RuleForDecision {
  return {
    start_date: '2026-01-15',
    end_date: null,
    last_generated_date: '2026-01-15',
    frequency: 'monthly',
    ...overrides,
  }
}

describe('decideRecurrenceInstance', () => {
  // ── 6.7: No se genera más de una instancia pendiente por regla ────────────
  it('skips generation when a pending instance already exists', () => {
    const decision = decideRecurrenceInstance(makeRule(), '2026-06-30', true)
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })

  it('skips generation when next date has not arrived yet', () => {
    const decision = decideRecurrenceInstance(makeRule(), '2026-02-01', false)
    expect(decision).toEqual({ generate: false, reason: 'not_due' })
  })

  it('generates on the exact day the next instance is due', () => {
    const decision = decideRecurrenceInstance(makeRule(), '2026-02-15', false)
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-15' })
  })

  it('generates when past the due date (catch-up)', () => {
    const decision = decideRecurrenceInstance(makeRule(), '2026-03-20', false)
    // next from 2026-01-15 monthly = 2026-02-15; that's <= today.
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-15' })
  })

  it('uses start_date when last_generated_date is null', () => {
    const decision = decideRecurrenceInstance(
      makeRule({ last_generated_date: null }),
      '2026-02-20',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-15' })
  })

  // ── 6.9: Regla con end_date se desactiva al superar fecha final ───────────
  it('skips generation when next date is past end_date', () => {
    const decision = decideRecurrenceInstance(
      makeRule({
        last_generated_date: '2026-06-15',
        end_date: '2026-06-30',
      }),
      '2026-08-01',
      false,
    )
    // next from 2026-06-15 monthly = 2026-07-15 > end_date 2026-06-30.
    expect(decision).toEqual({ generate: false, reason: 'past_end_date' })
  })

  it('still generates when next date equals end_date', () => {
    const decision = decideRecurrenceInstance(
      makeRule({
        last_generated_date: '2026-05-15',
        end_date: '2026-06-15',
      }),
      '2026-06-20',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-06-15' })
  })

  it('preserves the start_date anchor across short months', () => {
    // Monthly rule started on Jan 31; after Feb (28 days) the next anchor
    // should snap back to 31 in March, not stay at 28.
    const decision = decideRecurrenceInstance(
      makeRule({
        start_date: '2026-01-31',
        last_generated_date: '2026-02-28',
        frequency: 'monthly',
      }),
      '2026-04-01',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-03-31' })
  })

  it('handles weekly frequency', () => {
    const decision = decideRecurrenceInstance(
      makeRule({
        start_date: '2026-05-01',
        last_generated_date: '2026-05-01',
        frequency: 'weekly',
      }),
      '2026-05-09',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-05-08' })
  })

  it('has_pending takes precedence over not_due', () => {
    // Even when not due, hasPending check comes first.
    const decision = decideRecurrenceInstance(makeRule(), '2026-01-20', true)
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })

  it('has_pending takes precedence over past_end_date', () => {
    const decision = decideRecurrenceInstance(
      makeRule({
        last_generated_date: '2026-06-15',
        end_date: '2026-06-30',
      }),
      '2026-08-01',
      true,
    )
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })
})
