import { describe, expect, it } from 'vitest'
import {
  decideRecurrenceInstance,
  getNextExpectedOccurrence,
  occurrenceAt,
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
  last_generated_date: '2026-05-01',
})

const FAR_FUTURE = '2028-01-01'

// Run the generator the way it actually runs: each instance it creates is later
// confirmed, which advances the cursor and lets the next call see it.
const runGenerator = (rule: RuleForProjection, today: string): string[] => {
  const produced: string[] = []
  let cursor = rule.last_generated_date
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

describe('a cursor off the schedule keeps the behaviour it has today', () => {
  // ANY unit can drift. `addInterval` resumes the cadence from the cursor, and
  // `anchorDate` only restores the DAY OF MONTH — not the phase of months or
  // years. The one combination that cannot drift is month with
  // `interval_count = 1`, because every month is on its schedule.
  const everyThreeDays = (cap: number | null, cursor: string): RuleForProjection => ({
    id: 'r',
    start_date: '2026-05-01',
    end_date: null,
    interval_count: 3,
    interval_unit: 'day',
    max_occurrences: cap,
    last_generated_date: cursor,
  })

  it('a month rule with interval_count 1 re-anchors, so it cannot drift', () => {
    // start 2026-05-01, cursor 2026-06-10 ⇒ next is 2026-07-01, not 2026-07-10:
    // the day is restored, and every month is on the schedule anyway.
    const decision = decideRecurrenceInstance(
      { ...seededRule(3), last_generated_date: '2026-06-10' },
      FAR_FUTURE,
      false,
    )
    expect(decision).toEqual({ generate: true, scheduled_date: '2026-07-01' })
  })

  it('REGRESSION: an every-2-months rule drifts even though the day is restored', () => {
    // Schedule: 2026-01-01, 03-01, 05-01, 07-01… The cursor at 2026-02-10 is off
    // it, and the next date the generator computes, 2026-04-01, is off it too —
    // the day of month came back, the phase of months did not.
    const everyTwoMonths = {
      start_date: '2026-01-01',
      end_date: null,
      interval_count: 2,
      interval_unit: 'month' as const,
      max_occurrences: 2,
      last_generated_date: '2026-02-10',
    }
    expect(occurrenceAt(everyTwoMonths, 1)).toBe('2026-03-01')
    expect(occurrenceOrdinal(everyTwoMonths, '2026-04-01')).toBeNull()

    // No ordinal ⇒ the row count decides, exactly as it does today.
    expect(decideRecurrenceInstance(everyTwoMonths, FAR_FUTURE, false, 1)).toEqual({
      generate: true,
      scheduled_date: '2026-04-01',
    })
    expect(decideRecurrenceInstance(everyTwoMonths, FAR_FUTURE, false, 2)).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })

  it('REGRESSION: a yearly rule whose cursor landed in another month drifts', () => {
    // Schedule: every 2026-01-01. The cursor at 2026-06-10 puts the next date at
    // 2027-06-01 — right day, wrong month, so no ordinal.
    const yearly = {
      start_date: '2026-01-01',
      end_date: null,
      interval_count: 1,
      interval_unit: 'year' as const,
      max_occurrences: 3,
      last_generated_date: '2026-06-10',
    }
    expect(occurrenceAt(yearly, 1)).toBe('2027-01-01')
    expect(occurrenceOrdinal(yearly, '2027-06-01')).toBeNull()

    expect(decideRecurrenceInstance(yearly, FAR_FUTURE, false, 1)).toEqual({
      generate: true,
      scheduled_date: '2027-06-01',
    })
    expect(decideRecurrenceInstance(yearly, FAR_FUTURE, false, 3)).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })

  it('REGRESSION: a day rule off phase is not charged against another occurrence', () => {
    // Cursor 2026-06-10 is 40 days from start; 40 % 3 = 1, so it is off the
    // schedule, and the next date, 2026-06-13, is off it too. The calendar's
    // 16th occurrence is 2026-06-15 — a DIFFERENT date. Reading the cap off that
    // ordinal made a cap of 15 refuse 2026-06-13, dropping a due date the rule
    // was owed.
    const rule = everyThreeDays(15, '2026-06-10')
    expect(occurrenceOrdinal(rule, '2026-06-13')).toBeNull()
    expect(occurrenceAt(rule, 15)).toBe('2026-06-15')

    // With 3 rows materialized and a cap of 15, today's behaviour generates.
    expect(decideRecurrenceInstance(rule, FAR_FUTURE, false, 3)).toEqual({
      generate: true,
      scheduled_date: '2026-06-13',
    })
    // And the row count still stops it where it stops it today.
    expect(decideRecurrenceInstance(rule, FAR_FUTURE, false, 15)).toEqual({
      generate: false,
      reason: 'max_occurrences_reached',
    })
  })

  it('a day rule ON phase uses the calendar, not the rows', () => {
    // 2026-06-09 is 39 days from start; 39 % 3 = 0 ⇒ the 14th occurrence, so the
    // next one, 2026-06-12, is the 15th. A cap of 15 lets it through and a cap
    // of 14 does not, whatever the row count says.
    const rule = everyThreeDays(15, '2026-06-09')
    expect(occurrenceOrdinal(rule, '2026-06-12')).toBe(15)
    expect(decideRecurrenceInstance(rule, FAR_FUTURE, false, 99)).toEqual({
      generate: true,
      scheduled_date: '2026-06-12',
    })
    expect(decideRecurrenceInstance(everyThreeDays(14, '2026-06-09'), FAR_FUTURE, false, 0)).toEqual({
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
    expect(getNextExpectedOccurrence(rule, '2026-07-02', '2026-07-01')).toBeNull()
  })

  it('a directly created rule with a cap of 3 also produces 3, start_date included', () => {
    // No seed movement: the cursor is null and the 1st occurrence falls ON
    // start_date, so all three are materialized.
    const rule = { ...seededRule(3), last_generated_date: null }

    const materialized = runGenerator(rule, FAR_FUTURE)
    expect(materialized).toEqual(['2026-05-01', '2026-06-01', '2026-07-01'])
    expect(materialized.length).toBe(3)
  })

  it('deleting instance rows does not hand the rule extra occurrences', () => {
    // The old cap read the rows back, so wiping them reopened the rule. The
    // ordinal only knows the calendar and the cursor, which the rows do not own.
    const rule = seededRule(3)
    const exhausted = { ...rule, last_generated_date: '2026-07-01' }
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
