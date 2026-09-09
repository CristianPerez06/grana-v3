import { describe, expect, it } from 'vitest'
import { owedOccurrences, type OccurrenceSchedule } from '../src/recurrences'

/**
 * `owedOccurrences` is the question the generator has to ask: not "is there one
 * more?" but "which ones are missing?".
 *
 * The old question could only be answered once per rule, because the answer came
 * from a cursor that moved only when the user resolved something — so a rule with
 * one unresolved pending occurrence never produced anything again. Deriving the
 * answer from the calendar minus what already exists removes the trap.
 */

const TODAY = '2026-09-08'
const HORIZON = '2025-09-08' // 12 months back

const monthly = (o: Partial<OccurrenceSchedule> = {}): OccurrenceSchedule => ({
  start_date: '2026-01-10',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  ...o,
})

describe('owedOccurrences', () => {
  it('emits strictly after the floor, never up to it', () => {
    // Everything up to `reconstructFrom` the rule already considers covered.
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-06-10',
      horizon: HORIZON,
      today: TODAY,
      existing: [],
    })
    expect(owed).toEqual(['2026-07-10', '2026-08-10'])
    expect(owed).not.toContain('2026-06-10')
  })

  it('an unresolved pending occurrence removes ITS OWN date and nothing else', () => {
    // THE #96 fix, stated as a property. The cursor would have blocked every date
    // after the pending one too; the existing-set only removes the one date.
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-05-10',
      horizon: HORIZON,
      today: TODAY,
      existing: ['2026-06-10'],
    })
    expect(owed).toEqual(['2026-07-10', '2026-08-10'])
  })

  it('the exact #96 case: a stuck rule is owed 29 occurrences', () => {
    // Every 3 days from 2026-05-02, floor at the cursor 2026-06-10, one pending
    // occurrence on 2026-06-13 that never advanced anything.
    const owed = owedOccurrences({
      schedule: {
        start_date: '2026-05-02',
        end_date: null,
        interval_count: 3,
        interval_unit: 'day',
        max_occurrences: null,
      },
      reconstructFrom: '2026-06-10',
      horizon: HORIZON,
      today: TODAY,
      existing: ['2026-06-13'],
    })
    expect(owed).toHaveLength(29)
    expect(owed[0]).toBe('2026-06-16')
    expect(owed[owed.length - 1]).toBe(TODAY)
    expect(owed).not.toContain('2026-06-13')
  })

  it('what is already resolved is not owed, whatever its state', () => {
    // Confirmed, skipped or pending: the row exists, so the date is not missing.
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-04-10',
      horizon: HORIZON,
      today: TODAY,
      existing: ['2026-05-10', '2026-07-10'],
    })
    expect(owed).toEqual(['2026-06-10', '2026-08-10'])
  })

  it('resolving OUT OF ORDER does not regenerate what was resolved', () => {
    // August resolved before July: July is still owed, August is not, and neither
    // one moves the floor. With a cursor this could not even be expressed.
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-06-10',
      horizon: HORIZON,
      today: TODAY,
      existing: ['2026-08-10'],
    })
    expect(owed).toEqual(['2026-07-10'])
  })

  it('nothing in the future is owed', () => {
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-06-10',
      horizon: HORIZON,
      today: '2026-07-09',
      existing: [],
    })
    expect(owed).toEqual([])
  })

  it('the horizon limits how far back the rebuild reaches', () => {
    // An old rule whose floor sits years back is not owed its whole history.
    const owed = owedOccurrences({
      schedule: monthly({ start_date: '2019-03-10' }),
      reconstructFrom: '2019-03-10',
      horizon: '2026-07-01',
      today: TODAY,
      existing: [],
    })
    expect(owed).toEqual(['2026-07-10', '2026-08-10'])
  })

  it('end_date and max_occurrences both bound the list', () => {
    expect(
      owedOccurrences({
        schedule: monthly({ end_date: '2026-07-31' }),
        reconstructFrom: '2026-05-10',
        horizon: HORIZON,
        today: TODAY,
        existing: [],
      }),
    ).toEqual(['2026-06-10', '2026-07-10'])

    // Cap of 7 ⇒ occurrences 1..7 = Jan through Jul.
    expect(
      owedOccurrences({
        schedule: monthly({ max_occurrences: 7 }),
        reconstructFrom: '2026-05-10',
        horizon: HORIZON,
        today: TODAY,
        existing: [],
      }),
    ).toEqual(['2026-06-10', '2026-07-10'])
  })

  it('a rule with nothing missing is owed nothing', () => {
    const owed = owedOccurrences({
      schedule: monthly(),
      reconstructFrom: '2026-06-10',
      horizon: HORIZON,
      today: TODAY,
      existing: ['2026-07-10', '2026-08-10'],
    })
    expect(owed).toEqual([])
  })
})
