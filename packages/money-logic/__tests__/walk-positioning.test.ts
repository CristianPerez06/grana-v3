import { describe, expect, it } from 'vitest'
import {
  occurrenceAt,
  walkOccurrences,
  type OccurrenceSchedule,
} from '../src/index'

const schedule = (o: Partial<OccurrenceSchedule> = {}): OccurrenceSchedule => ({
  start_date: '2026-01-10',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  ...o,
})

describe('occurrenceAt — closed form, equivalent to stepping', () => {
  it('matches stepping one interval at a time, end-of-month clamping included', () => {
    // A rule anchored on the 31st: January → February clamps to 28, and March
    // goes BACK to the 31st. If the jump accumulated the clamp, March would
    // land on the 28th.
    const s = schedule({ start_date: '2026-01-31' })
    expect(occurrenceAt(s, 0)).toBe('2026-01-31')
    expect(occurrenceAt(s, 1)).toBe('2026-02-28')
    expect(occurrenceAt(s, 2)).toBe('2026-03-31')
    expect(occurrenceAt(s, 3)).toBe('2026-04-30')
    expect(occurrenceAt(s, 13)).toBe('2027-02-28')
  })

  it('holds for day, week and year units', () => {
    expect(occurrenceAt(schedule({ interval_unit: 'day', interval_count: 3 }), 10)).toBe('2026-02-09')
    expect(occurrenceAt(schedule({ interval_unit: 'week', interval_count: 2 }), 5)).toBe('2026-03-21')
    expect(occurrenceAt(schedule({ interval_unit: 'year', interval_count: 1 }), 4)).toBe('2030-01-10')
  })
})

describe('walkOccurrences — positions at the window edge instead of crawling from the origin', () => {
  it('REGRESSION 750 steps: a three-year-old daily rule still reaches today', () => {
    // The old walker crawled from start_date with a 750-step cap and stopped at
    // 2024-09-26 — 347 days BEFORE the 12-month horizon. The generator could not
    // even see the current occurrence.
    const daily = schedule({
      start_date: '2022-09-08',
      interval_unit: 'day',
      interval_count: 1,
    })
    const horizon = '2025-09-08'
    const today = '2026-09-08'

    const out = walkOccurrences(daily, { from: horizon, to: today })

    expect(out[0]).toBe(horizon)
    expect(out).toContain(today)
    // Without arithmetic positioning, `out` would have come back empty.
    expect(out.length).toBeGreaterThan(300)
  })

  it('an old monthly rule emits the requested window and nothing before it', () => {
    const s = schedule({ start_date: '2019-03-15' })
    const out = walkOccurrences(s, { from: '2026-07-01', to: '2026-10-01' })
    expect(out).toEqual(['2026-07-15', '2026-08-15', '2026-09-15'])
  })

  it('honours the cursor: emits only what is strictly after it', () => {
    const out = walkOccurrences(schedule(), {
      from: '2026-01-01',
      to: '2026-06-01',
      cursor: '2026-03-10',
    })
    expect(out).toEqual(['2026-04-10', '2026-05-10'])
  })

  it('a pending occurrence does not move the cursor, so its date keeps being emitted', () => {
    // The cursor stayed in February even though a March occurrence is pending.
    const out = walkOccurrences(schedule(), {
      from: '2026-01-01',
      to: '2026-04-30',
      cursor: '2026-02-10',
    })
    expect(out).toContain('2026-03-10')
  })

  it('max_occurrences counts from start_date, not from what is emitted', () => {
    // Cap of 3 ⇒ occurrences 0,1,2 = Jan, Feb, Mar. Asking from February emits
    // two, not three: January already consumed a position.
    const s = schedule({ max_occurrences: 3 })
    expect(walkOccurrences(s, { from: '2026-01-01' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ])
    expect(walkOccurrences(s, { from: '2026-02-01' })).toEqual([
      '2026-02-10', '2026-03-10',
    ])
  })

  it('stops at end_date', () => {
    const s = schedule({ end_date: '2026-03-15' })
    expect(walkOccurrences(s, { from: '2026-01-01' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ])
  })

  it('limit truncates the emission', () => {
    const out = walkOccurrences(schedule({ start_date: '2020-01-10' }), {
      from: '2026-01-01',
      limit: 2,
    })
    expect(out).toEqual(['2026-01-10', '2026-02-10'])
  })

  it('a window earlier than the rule start emits nothing', () => {
    const out = walkOccurrences(schedule(), { from: '2025-01-01', to: '2025-12-01' })
    expect(out).toEqual([])
  })

  it('end-of-month clamping survives the positioning jump', () => {
    const s = schedule({ start_date: '2026-01-31' })
    const out = walkOccurrences(s, { from: '2027-02-01', to: '2027-04-30' })
    expect(out).toEqual(['2027-02-28', '2027-03-31', '2027-04-30'])
  })

  it('the #96 case: a every-3-days rule with the cursor stuck in June', () => {
    // start_date is chosen so the cursor DOES land on the schedule: 2026-05-02
    // + 39 days = 2026-06-10. See the next test for the case where it does not.
    const s = schedule({
      start_date: '2026-05-02',
      interval_unit: 'day',
      interval_count: 3,
    })
    const out = walkOccurrences(s, {
      from: '2025-09-08',        // 12-month horizon
      to: '2026-09-08',          // today
      cursor: '2026-06-10',      // the stuck cursor
    })
    // 30 occurrences from 13/06 through today. The generator will emit 29: the
    // 13/06 one already exists as pending and the generator dedupes it, not the
    // walker.
    expect(out[0]).toBe('2026-06-13')
    expect(out[out.length - 1]).toBe('2026-09-08')
    expect(out.length).toBe(30)
  })

  it('a cursor OFF the schedule jumps to the next valid date', () => {
    // This can happen when the rule schedule is edited after the cursor was
    // written. The calendar wins: the walker does NOT resume the cadence from
    // the cursor, it positions on the next real occurrence.
    //
    // Note: today's generator does the opposite — `addInterval(cursor, …)`, i.e.
    // cursor + interval. Both agree while the cursor sits on the schedule, which
    // is the normal case; when it does not, they diverge by a few days.
    // Anchoring on the calendar is the correct one: it is the only definition
    // that does not depend on when the last occurrence was resolved.
    const s = schedule({
      start_date: '2026-05-01',
      interval_unit: 'day',
      interval_count: 3,
    })
    // 2026-06-10 is 40 days from start: 40 % 3 = 1 ⇒ off the schedule.
    const out = walkOccurrences(s, { from: '2026-06-01', to: '2026-06-20', cursor: '2026-06-10' })
    expect(out[0]).toBe('2026-06-12')   // the next real occurrence, not 06-13
  })
})
