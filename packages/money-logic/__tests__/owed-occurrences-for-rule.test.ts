import { describe, expect, it } from 'vitest'
import {
  owedOccurrencesForRule,
  type PauseInterval,
  type ScheduleVersion,
} from '../src/recurrences'

// A rule's timeline is not one calendar: it is one per schedule version, minus
// the pause intervals. These cases pin the composition — which dates each
// segment owns, and which ones no segment does.

const monthlyOn23 = (effectiveFrom: string): ScheduleVersion => ({
  effective_from: effectiveFrom,
  interval_count: 1,
  interval_unit: 'month',
  anchor_date: '2026-01-23',
})

const base = {
  endDate: null,
  maxOccurrences: null,
  horizon: '2025-09-08',
  today: '2026-09-08',
  existing: [] as string[],
}

describe('owedOccurrencesForRule — one version, no pauses', () => {
  it('rebuilds the backlog a stuck rule never produced', () => {
    // The #96 shape: the floor sits at the last known point, and everything the
    // calendar owed after it comes back.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [],
      reconstructFrom: '2026-05-23',
    })

    expect(owed).toEqual(['2026-06-23', '2026-07-23', '2026-08-23'])
  })

  it('does not owe a date that already exists, whatever its state', () => {
    // July is skipped and August is confirmed: neither comes back. The cursor
    // would have blocked September too — that is the whole difference.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [],
      reconstructFrom: '2026-05-23',
      existing: ['2026-07-23', '2026-08-23'],
    })

    expect(owed).toEqual(['2026-06-23'])
  })

  it('never emits the floor itself', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-06-23')],
      pauses: [],
      reconstructFrom: '2026-06-23',
    })

    expect(owed).not.toContain('2026-06-23')
    expect(owed[0]).toBe('2026-07-23')
  })
})

describe('owedOccurrencesForRule — a schedule edit does not rewrite the past', () => {
  it('walks each stretch with the schedule that actually applied there', () => {
    // Monthly on the 23rd until 2026-07-01, biweekly from the 1st onwards.
    // Reading today's biweekly schedule backwards would fabricate June dates
    // the rule never produced.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [
        monthlyOn23('2026-05-23'),
        {
          effective_from: '2026-07-01',
          interval_count: 2,
          interval_unit: 'week',
          anchor_date: '2026-07-01',
        },
      ],
      pauses: [],
      reconstructFrom: '2026-05-23',
    })

    // June belongs to the monthly stretch: exactly one date, on the 23rd.
    expect(owed.filter((date) => date.startsWith('2026-06'))).toEqual(['2026-06-23'])
    // From July the biweekly calendar owns the timeline, anchored on the 1st.
    expect(owed.filter((date) => date >= '2026-07-01')).toEqual([
      '2026-07-01',
      '2026-07-15',
      '2026-07-29',
      '2026-08-12',
      '2026-08-26',
    ])
  })

  it('stops the old version the day the new one takes over', () => {
    // The monthly occurrence of 2026-07-23 is NOT owed: by then the rule was
    // already biweekly. A version boundary is a hard cut, not an overlap.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [
        monthlyOn23('2026-05-23'),
        {
          effective_from: '2026-07-01',
          interval_count: 2,
          interval_unit: 'week',
          anchor_date: '2026-07-01',
        },
      ],
      pauses: [],
      reconstructFrom: '2026-05-23',
    })

    expect(owed).not.toContain('2026-07-23')
  })
})

describe('owedOccurrencesForRule — a pause is not deferred billing', () => {
  const pausedJuneToSeptember: PauseInterval[] = [
    { paused_from: '2026-06-01', resumed_at: '2026-09-05' },
  ]

  it('does not recover what fell inside the pause', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: pausedJuneToSeptember,
      reconstructFrom: '2026-05-23',
    })

    expect(owed).toEqual([])
  })

  it('owes the first occurrence at or after the resume date', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: pausedJuneToSeptember,
      reconstructFrom: '2026-05-23',
      today: '2026-09-30',
    })

    expect(owed).toEqual(['2026-09-23'])
  })

  it('keeps what was already owed before the pause opened', () => {
    // June and July were hidden by the bug; the rule is paused in September and
    // resumed in October. Both stay owed — this is why the floor does not move
    // on pause or resume.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [{ paused_from: '2026-09-01', resumed_at: '2026-10-05' }],
      reconstructFrom: '2026-05-23',
      today: '2026-10-31',
    })

    expect(owed).toEqual(['2026-06-23', '2026-07-23', '2026-08-23', '2026-10-23'])
  })

  it('owes nothing after a pause that is still open', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [{ paused_from: '2026-07-01', resumed_at: null }],
      reconstructFrom: '2026-05-23',
    })

    expect(owed).toEqual(['2026-06-23'])
  })

  it('composes several pauses over the same stretch', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [
        { paused_from: '2026-06-01', resumed_at: '2026-07-01' },
        { paused_from: '2026-08-01', resumed_at: '2026-09-01' },
      ],
      reconstructFrom: '2026-05-23',
    })

    expect(owed).toEqual(['2026-07-23'])
  })
})

describe('owedOccurrencesForRule — bounds', () => {
  it('does not reach back past the horizon', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [
        {
          effective_from: '2023-01-23',
          interval_count: 1,
          interval_unit: 'month',
          anchor_date: '2023-01-23',
        },
      ],
      pauses: [],
      reconstructFrom: '2023-01-22',
    })

    expect(owed[0]).toBe('2025-09-23')
    expect(owed.at(-1)).toBe('2026-08-23')
  })

  it('owes nothing in the future', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [],
      reconstructFrom: '2026-05-23',
      today: '2026-06-22',
    })

    expect(owed).toEqual([])
  })

  it('honours end_date', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [monthlyOn23('2026-05-23')],
      pauses: [],
      reconstructFrom: '2026-05-23',
      endDate: '2026-07-31',
    })

    expect(owed).toEqual(['2026-06-23', '2026-07-23'])
  })

  it('returns nothing when the rule has no known schedule', () => {
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [],
      pauses: [],
      reconstructFrom: '2026-05-23',
    })

    expect(owed).toEqual([])
  })
})

describe('owedOccurrencesForRule — max_occurrences is one cap for the rule', () => {
  // A 6-cuota purchase whose schedule the user edited. The cap counts positions
  // on the RULE's calendar; handing it to each version separately produced it
  // once per version — 12 cuotas for a 6-cuota purchase.
  const editedRule = {
    ...base,
    versions: [
      {
        effective_from: '2026-01-10',
        interval_count: 1,
        interval_unit: 'month' as const,
        anchor_date: '2026-01-10',
      },
      {
        effective_from: '2026-04-01',
        interval_count: 2,
        interval_unit: 'week' as const,
        anchor_date: '2026-04-01',
      },
    ],
    pauses: [],
    reconstructFrom: '2026-01-09',
    horizon: '2025-09-08',
  }

  it('never produces more occurrences than the cap, across versions', () => {
    const owed = owedOccurrencesForRule({ ...editedRule, maxOccurrences: 6 })

    expect(owed).toHaveLength(6)
  })

  it('spends the cap in calendar order: the first version first', () => {
    const owed = owedOccurrencesForRule({ ...editedRule, maxOccurrences: 6 })

    // Three monthly (Jan/Feb/Mar on the 10th), then the biweekly ones from Apr 1
    // until the cap runs out.
    expect(owed).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
      '2026-04-01',
      '2026-04-15',
      '2026-04-29',
    ])
  })

  it('counts an occurrence the cap already spent even if it is not owed', () => {
    // The first three are already materialized. The cap is still 6, so only
    // three more may appear — not six more.
    const owed = owedOccurrencesForRule({
      ...editedRule,
      maxOccurrences: 6,
      existing: ['2026-01-10', '2026-02-10', '2026-03-10'],
    })

    expect(owed).toEqual(['2026-04-01', '2026-04-15', '2026-04-29'])
  })

  it('counts occurrences hidden behind the floor', () => {
    // The floor moved to March: January and February are not owed, but they
    // happened, and the cap has to know it.
    const owed = owedOccurrencesForRule({
      ...editedRule,
      maxOccurrences: 6,
      reconstructFrom: '2026-03-10',
    })

    expect(owed).toEqual(['2026-04-01', '2026-04-15', '2026-04-29'])
  })

  it('does not count occurrences that fell inside a pause', () => {
    // Paused over February and March: those two never existed, so they never
    // spent the cap, and the rule still gets its six.
    const owed = owedOccurrencesForRule({
      ...editedRule,
      maxOccurrences: 6,
      pauses: [{ paused_from: '2026-02-01', resumed_at: '2026-04-01' }],
    })

    expect(owed).toHaveLength(6)
    expect(owed).not.toContain('2026-02-10')
    expect(owed).not.toContain('2026-03-10')
  })

  it('keeps the single-version cap unchanged', () => {
    // The shape every rule in production has today: one assumed version. The fix
    // must not move this.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [
        {
          effective_from: '2026-01-10',
          interval_count: 1,
          interval_unit: 'month',
          anchor_date: '2026-01-10',
        },
      ],
      pauses: [],
      reconstructFrom: '2026-01-09',
      maxOccurrences: 3,
    })

    expect(owed).toEqual(['2026-01-10', '2026-02-10', '2026-03-10'])
  })

  it('counts the seed occurrence a rule born from a movement already has', () => {
    // The rule was created from a movement on 2026-01-10, so the floor sits on
    // it: the cap of 3 leaves two more, not three.
    const owed = owedOccurrencesForRule({
      ...base,
      versions: [
        {
          effective_from: '2026-01-10',
          interval_count: 1,
          interval_unit: 'month',
          anchor_date: '2026-01-10',
        },
      ],
      pauses: [],
      reconstructFrom: '2026-01-10',
      maxOccurrences: 3,
    })

    expect(owed).toEqual(['2026-02-10', '2026-03-10'])
  })
})
