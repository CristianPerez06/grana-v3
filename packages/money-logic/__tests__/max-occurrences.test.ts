import { describe, expect, it } from 'vitest'
import {
  coveredOccurrences,
  decideRecurrenceInstance,
  getNextExpectedOccurrence,
  occurrenceOrdinal,
  projectRuleOccurrences,
  type RuleForProjection,
} from '../src/recurrences'

// A rule created FROM A MOVEMENT: that movement is the seed, it covers
// `start_date` and it materializes no instance row. This is the case where
// counting rows and counting the calendar used to disagree.
const seededRule = (cap: number | null): RuleForProjection => ({
  id: 'r',
  start_date: '2026-05-01',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: cap,
  // The seed movement covers start_date and leaves no instance row behind.
  covered: coveredOccurrences({
    startDate: '2026-05-01',
    seededFromMovement: true,
    existing: [],
  }),
})

const FAR_FUTURE = '2028-01-01'

// Run the generator the way it actually runs: each instance it creates is later
// confirmed, which advances the cursor and lets the next call see it.
const runGenerator = (
  rule: RuleForProjection,
  today: string,
  options: { fromCursor?: string | null } = {},
): string[] => {
  const produced: string[] = []
  let cursor: string | null =
    options.fromCursor !== undefined ? options.fromCursor : rule.start_date
  for (let guard = 0; guard < 50; guard++) {
    const decision = decideRecurrenceInstance(
      { ...rule, last_generated_date: cursor },
      today,
      false,
    )
    if (!decision.generate) break
    produced.push(decision.scheduled_date)
    cursor = decision.scheduled_date
  }
  return produced
}

describe('occurrenceOrdinal', () => {
  it('counts start_date as the 1st occurrence', () => {
    const s = seededRule(null)
    expect(occurrenceOrdinal(s, '2026-05-01')).toBe(1)
    expect(occurrenceOrdinal(s, '2026-06-01')).toBe(2)
    expect(occurrenceOrdinal(s, '2026-07-01')).toBe(3)
  })

  it('returns null for a date the schedule does not contain', () => {
    // NOT the ordinal of the next occurrence: 2026-06-15 is not the 3rd, the
    // 2026-07-01 is. Rounding here is what made the cap drop a real due date.
    expect(occurrenceOrdinal(seededRule(null), '2026-06-15')).toBeNull()
  })
})

describe('a cursor off the schedule: the calendar decides, not the cursor', () => {
  // These rules do not exist in production — the cursor-phase audit measured 61
  // rules with a cursor and found ZERO off schedule — and migration 0064 aborts
  // if that ever stops holding at migration time. But an edit can still move a
  // rule's `start_date` afterwards, so the behaviour has to be defined, and it is:
  // the next occurrence is the calendar's, never the cursor's own cadence.
  //
  // Two independent mechanisms take a cursor off the schedule. PHASE:
  // `anchorDate` restores the DAY OF MONTH, not the phase of months or years. A
  // MOVED START: `updateRecurrence` moves `start_date` without touching the
  // cursor, which reaches even a monthly or daily rule of interval 1.
  // These feed `decideRecurrenceInstance`, which is the one place that still
  // speaks in cursors — the projection stopped.
  type DecisionRule = Omit<RuleForProjection, 'covered' | 'id'> & {
    last_generated_date: string | null
  }
  const rule = (o: Partial<DecisionRule>): DecisionRule => ({
    start_date: '2026-05-01',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month',
    max_occurrences: null,
    last_generated_date: null,
    ...o,
  })

  it('an every-2-months rule lands on the calendar, not on the cursor cadence', () => {
    // Schedule: 2026-01-01, 03-01, 05-01… The cursor at 2026-02-10 is off it.
    // Resuming from the cursor gave 2026-04-01, which is not an occurrence at
    // all; the calendar's next after that cursor is 2026-03-01.
    const s = rule({
      start_date: '2026-01-01',
      interval_count: 2,
      last_generated_date: '2026-02-10',
    })
    expect(decideRecurrenceInstance(s, FAR_FUTURE, false)).toEqual({
      generate: true,
      scheduled_date: '2026-03-01',
    })
    expect(occurrenceOrdinal(s, '2026-03-01')).toBe(2)
  })

  it('a yearly rule whose cursor landed in another month comes back to its month', () => {
    // Schedule: every 2026-01-01. Resuming from a cursor at 2026-06-10 gave
    // 2027-06-01 — right day, wrong month.
    const s = rule({
      start_date: '2026-01-01',
      interval_unit: 'year',
      last_generated_date: '2026-06-10',
    })
    expect(decideRecurrenceInstance(s, FAR_FUTURE, false)).toEqual({
      generate: true,
      scheduled_date: '2027-01-01',
    })
  })

  it('an every-3-days rule off phase returns to phase instead of keeping the cursor one', () => {
    // 2026-06-10 is 40 days from start; 40 % 3 = 1. Resuming from it gave
    // 2026-06-13, also off phase; the calendar's next is 2026-06-12.
    const s = rule({
      start_date: '2026-05-01',
      interval_count: 3,
      interval_unit: 'day',
      last_generated_date: '2026-06-10',
    })
    expect(decideRecurrenceInstance(s, FAR_FUTURE, false)).toEqual({
      generate: true,
      scheduled_date: '2026-06-12',
    })
  })

  it('a moved start_date no longer produces dates BEFORE the rule begins', () => {
    // The clearest gain. With the start pushed to 2026-06-15 and the cursor left
    // at 2026-01-10, resuming from the cursor gave 2026-02-15 — a due date
    // earlier than the rule itself. The calendar cannot produce that: its first
    // occurrence IS the start date.
    for (const unit of ['month', 'day'] as const) {
      const s = rule({
        start_date: '2026-06-15',
        interval_unit: unit,
        last_generated_date: '2026-01-10',
      })
      expect(decideRecurrenceInstance(s, FAR_FUTURE, false)).toEqual({
        generate: true,
        scheduled_date: '2026-06-15',
      })
    }
  })

  it('the cap is always readable now: every next date is an occurrence', () => {
    // The row-count fallback existed for the case where `nextDate` had no
    // ordinal. Reading the date off the calendar makes that case unreachable, so
    // the cap applies to a drifted rule exactly as it does to any other.
    const s = rule({
      start_date: '2026-01-01',
      interval_count: 2,
      last_generated_date: '2026-02-10',
      max_occurrences: 2,
    })
    expect(occurrenceOrdinal(s, '2026-03-01')).toBe(2)
    expect(decideRecurrenceInstance(s, FAR_FUTURE, false)).toEqual({
      generate: true,
      scheduled_date: '2026-03-01',
    })
    expect(
      decideRecurrenceInstance({ ...s, max_occurrences: 1 }, FAR_FUTURE, false),
    ).toEqual({ generate: false, reason: 'max_occurrences_reached' })
  })

  it('a rule ON phase reads the same cap, from the same calendar', () => {
    // 2026-06-09 is 39 days from a 2026-05-01 start; 39 % 3 = 0 ⇒ the 14th
    // occurrence, so the next one, 2026-06-12, is the 15th. A cap of 15 lets it
    // through and a cap of 14 does not — the same rule as for a drifted one,
    // which is the point of removing the fallback.
    const onPhase = (cap: number | null): DecisionRule =>
      rule({
        start_date: '2026-05-01',
        interval_count: 3,
        interval_unit: 'day',
        max_occurrences: cap,
        last_generated_date: '2026-06-09',
      })
    expect(occurrenceOrdinal(onPhase(null), '2026-06-12')).toBe(15)
    expect(decideRecurrenceInstance(onPhase(15), FAR_FUTURE, false)).toEqual({
      generate: true,
      scheduled_date: '2026-06-12',
    })
    expect(decideRecurrenceInstance(onPhase(14), FAR_FUTURE, false)).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })
})

describe('max_occurrences is one number across every surface', () => {
  // THE regression. A rule created from a movement with a cap of 3 has three
  // occurrences in total: the seed plus two. Before this, the generator counted
  // instance rows, the seed had none, so it materialized THREE more and the rule
  // produced four — the last one, 2026-08-01, on a date the projection never
  // announced.
  it('a rule seeded from a movement with a cap of 3 produces 3 occurrences in total', () => {
    const rule = seededRule(3)

    // The generator materializes the two that are left after the seed.
    const materialized = runGenerator(rule, FAR_FUTURE)
    expect(materialized).toEqual(['2026-06-01', '2026-07-01'])

    // The projection announces exactly the same two.
    const projected = projectRuleOccurrences(rule, '2026-01-01', '2029-01-01')
    expect(projected).toEqual(['2026-06-01', '2026-07-01'])

    // Seed + 2 = 3, the number the user asked for, on both counts.
    expect(1 + materialized.length).toBe(3)
    expect(1 + projected.length).toBe(3)

    // And nothing is offered after the last one.
    expect(
      getNextExpectedOccurrence(rule, '2026-07-02', ['2026-05-01', ...materialized]),
    ).toBeNull()
  })

  it('a directly created rule with a cap of 3 also produces 3, start_date included', () => {
    // No seed movement: the cursor is null and the 1st occurrence falls ON
    // start_date, so all three are materialized.
    const rule: RuleForProjection = { ...seededRule(3), covered: [] }

    const materialized = runGenerator(rule, FAR_FUTURE, { fromCursor: null })
    expect(materialized).toEqual(['2026-05-01', '2026-06-01', '2026-07-01'])
    expect(materialized.length).toBe(3)
  })

  it('deleting instance rows does not hand the rule extra occurrences', () => {
    // The old cap read the rows back, so wiping them reopened the rule. The
    // ordinal only knows the calendar, which the rows do not own.
    const exhausted = { ...seededRule(3), last_generated_date: '2026-07-01' }
    expect(decideRecurrenceInstance(exhausted, FAR_FUTURE, false)).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })

  it('an uncapped rule keeps going', () => {
    const materialized = runGenerator(seededRule(null), '2026-09-01')
    expect(materialized).toEqual(['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'])
  })
})
