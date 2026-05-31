import { describe, it, expect } from 'vitest'
import {
  decideRecurrenceInstance,
  type RuleForDecision,
} from '@grana/money-logic'

// Direct rule: created from scratch, no seed transaction. last_generated_date is
// null, so the FIRST instance falls ON start_date (not start_date + interval).
const directRule: RuleForDecision = {
  start_date: '2026-01-15',
  end_date: null,
  last_generated_date: null,
  frequency: 'monthly',
}

// Seeded rule: created from a movement or a suggestion. last_generated_date is
// the date already covered by a real transaction, so the next instance advances
// by one interval.
const seededRule: RuleForDecision = {
  start_date: '2026-01-15',
  end_date: null,
  last_generated_date: '2026-01-15',
  frequency: 'monthly',
}

describe('decideRecurrenceInstance — direct rules (last_generated_date null)', () => {
  it('generates the first instance ON start_date when start_date is today', () => {
    const decision = decideRecurrenceInstance(directRule, '2026-01-15', false)
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-01-15' })
  })

  it('generates a single instance ON start_date when start_date is in the past', () => {
    // A past start_date does NOT backfill: the decision yields exactly one
    // instance at start_date. The one-pending-per-rule index keeps it single.
    const decision = decideRecurrenceInstance(directRule, '2026-06-20', false)
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-01-15' })
  })

  it('does not generate while a pending instance already exists', () => {
    const decision = decideRecurrenceInstance(directRule, '2026-06-20', true)
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })

  it('does not generate when start_date is still in the future', () => {
    const futureRule = { ...directRule, start_date: '2026-12-01' }
    const decision = decideRecurrenceInstance(futureRule, '2026-11-30', false)
    expect(decision).toEqual({ generate: false, reason: 'not_due' })
  })
})

describe('decideRecurrenceInstance — seeded rules (last_generated_date set)', () => {
  it('generates the next instance one interval after last_generated_date', () => {
    const decision = decideRecurrenceInstance(seededRule, '2026-03-01', false)
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-15' })
  })

  it('does not generate when the next date is still in the future', () => {
    const decision = decideRecurrenceInstance(seededRule, '2026-01-20', false)
    expect(decision).toEqual({ generate: false, reason: 'not_due' })
  })

  it('does not generate when a pending instance already exists', () => {
    const decision = decideRecurrenceInstance(seededRule, '2026-03-01', true)
    expect(decision).toEqual({ generate: false, reason: 'has_pending' })
  })

  it('clamps end-of-month: 31-Jan + 1 month becomes 28-Feb', () => {
    const decision = decideRecurrenceInstance(
      { ...seededRule, start_date: '2026-01-31', last_generated_date: '2026-01-31' },
      '2026-03-01',
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-02-28' })
  })

  it('does not generate past the end date', () => {
    const decision = decideRecurrenceInstance(
      { ...seededRule, end_date: '2026-02-01' },
      '2026-03-01',
      false,
    )
    expect(decision).toEqual({ generate: false, reason: 'past_end_date' })
  })
})
