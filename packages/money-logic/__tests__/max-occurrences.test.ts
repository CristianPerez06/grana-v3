import { describe, expect, it } from 'vitest'
import {
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

  it('gives a date off the schedule the ordinal of the next one on or after it', () => {
    expect(occurrenceOrdinal(seededRule(null), '2026-06-15')).toBe(3)
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
