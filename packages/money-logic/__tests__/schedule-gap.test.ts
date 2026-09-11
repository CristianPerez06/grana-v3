import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_NEVER_RULES,
  getNextExpectedOccurrence,
  owedOccurrencesForRule,
  projectRuleOccurrences,
} from '../src/recurrences'

/**
 * Correcting a rule's anchor mid-cycle (#121).
 *
 * The calendar half of the fix, injected with a fixed `today` so every case is a
 * date and not a mood. What the database records is an ANSWER — from which
 * occurrence the corrected schedule rules — and these pin what that answer must
 * produce in the three situations no automatic formula could tell apart, plus
 * the gap it opens.
 *
 * The scenario throughout: a monthly salary anchored on the 8th, corrected to
 * the 10th on 10 September 2026.
 */

const TODAY = '2026-09-10'
const monthly = (anchor: string) => ({
  interval_count: 1,
  interval_unit: 'month' as const,
  anchor_date: anchor,
})

const owed = (args: {
  versions: Array<{
    effective_from: string
    effective_until?: string | null
    anchor: string
  }>
  existing: string[]
  floor: string
}) =>
  owedOccurrencesForRule({
    versions: args.versions.map((v) => ({
      effective_from: v.effective_from,
      effective_until: v.effective_until ?? null,
      ...monthly(v.anchor),
    })),
    pauses: [],
    reconstructFrom: args.floor,
    horizon: '2026-01-01',
    today: TODAY,
    existing: new Set(args.existing),
    endDate: null,
    maxOccurrences: null,
  })

describe('A · the cycle in flight was already resolved', () => {
  it('owes nothing today: the corrected date belongs to the next cycle', () => {
    // The salary of 8 September is confirmed. Correcting to the 10th and choosing
    // OCTOBER must not owe 10 September — that would be the same salary twice.
    // What happens when the calendar reaches 8 October is a different question,
    // and it has its own test below: from here, today, it is simply the future.
    expect(
      owed({
        versions: [
          { effective_from: '2026-06-08', effective_until: '2026-09-10', anchor: '2026-06-08' },
          { effective_from: '2026-10-10', anchor: '2026-06-10' },
        ],
        existing: ['2026-07-08', '2026-08-08', '2026-09-08'],
        floor: '2026-06-08',
      }),
    ).toEqual([])
  })
})

describe('B · the cycle in flight had not arrived', () => {
  it('owes the corrected date and not the old one', () => {
    // Corrected on 5 September, before the salary landed: September must vence on
    // the 10th, and NOT also on the 8th.
    const dates = owedOccurrencesForRule({
      versions: [
        { effective_from: '2026-06-08', effective_until: '2026-09-04', ...monthly('2026-06-08') },
        { effective_from: '2026-09-10', effective_until: null, ...monthly('2026-06-10') },
      ],
      pauses: [],
      reconstructFrom: '2026-08-08',
      horizon: '2026-01-01',
      today: '2026-09-10',
      existing: new Set<string>(),
      endDate: null,
      maxOccurrences: null,
    })
    expect(dates).toEqual(['2026-09-10'])
  })
})

describe('C · a rule with a backlog keeps the old dates', () => {
  it('materializes the backlog on the day it was owed, not on the corrected one', () => {
    expect(
      owed({
        versions: [
          { effective_from: '2026-06-08', effective_until: '2026-09-10', anchor: '2026-06-08' },
          { effective_from: '2026-10-10', anchor: '2026-06-10' },
        ],
        existing: [],
        floor: '2026-06-08',
      }),
    ).toEqual(['2026-07-08', '2026-08-08', '2026-09-08'])
  })
})

describe('the gap produces nothing', () => {
  // WITH TODAY INSIDE THE GAP, which is the only place the question exists. On
  // 10 September this passes with or without `effective_until`, because a walk
  // never goes past today and 8 October is in the future — a test standing there
  // proves the CHOICE, not the cut. The cut is what stops the old schedule from
  // firing one last time once the calendar reaches it.
  const versions = [
    { effective_from: '2026-06-08', effective_until: '2026-09-10', ...monthly('2026-06-08') },
    { effective_from: '2026-10-10', effective_until: null, ...monthly('2026-06-10') },
  ]

  it('owes nothing on 9 October, the day before the new schedule starts', () => {
    const dates = owedOccurrencesForRule({
      versions,
      pauses: [],
      reconstructFrom: '2026-06-08',
      horizon: '2026-01-01',
      today: '2026-10-09',
      existing: new Set(['2026-07-08', '2026-08-08', '2026-09-08']),
      endDate: null,
      maxOccurrences: null,
    })
    // 8 October is what the old schedule would produce if it kept ruling: the
    // same duplicate, one cycle later, on the old date.
    expect(dates).toEqual([])
  })

  it('owes the new date once the new schedule rules', () => {
    const dates = owedOccurrencesForRule({
      versions,
      pauses: [],
      reconstructFrom: '2026-06-08',
      horizon: '2026-01-01',
      today: '2026-10-10',
      existing: new Set(['2026-07-08', '2026-08-08', '2026-09-08']),
      endDate: null,
      maxOccurrences: null,
    })
    expect(dates).toEqual(['2026-10-10'])
  })
})

describe('every N days, where there is no such thing as a period', () => {
  it('applies the corrected phase from the chosen date', () => {
    // Every 3 days, phase shifted by one, ruling from 13 September. The old phase
    // (11, 14…) must stop and the new one (13, 16…) take over — with nothing
    // owed in between.
    const dates = owedOccurrencesForRule({
      versions: [
        {
          effective_from: '2026-09-02',
          effective_until: '2026-09-10',
          interval_count: 3,
          interval_unit: 'day',
          anchor_date: '2026-09-02',
        },
        {
          effective_from: '2026-09-13',
          effective_until: null,
          interval_count: 3,
          interval_unit: 'day',
          anchor_date: '2026-09-01',
        },
      ],
      pauses: [],
      reconstructFrom: '2026-09-01',
      horizon: '2026-01-01',
      today: '2026-09-16',
      existing: new Set<string>(),
      endDate: null,
      maxOccurrences: null,
    })
    expect(dates).toEqual(['2026-09-02', '2026-09-05', '2026-09-08', '2026-09-13', '2026-09-16'])
  })
})

describe('what the screens say during the gap', () => {
  const rule = {
    id: 'r1',
    start_date: '2026-06-10',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month' as const,
    max_occurrences: null,
    schedule_effective_from: '2026-10-10',
    covered: new Set<string>(),
  }

  it('“próxima fecha” is the first date of the NEW schedule', () => {
    // Without the floor this answers 10 September: the corrected calendar walked
    // from today, ignoring that it does not rule yet.
    expect(getNextExpectedOccurrence(rule, TODAY, rule.covered)).toBe('2026-10-10')
  })

  it('the projection announces nothing inside the gap', () => {
    expect(projectRuleOccurrences(rule, '2026-09-01', '2026-09-30')).toEqual([])
  })

  it('and picks up again once the new schedule rules', () => {
    expect(projectRuleOccurrences(rule, '2026-10-01', '2026-10-31')).toEqual(['2026-10-10'])
  })
})

describe('the three surfaces agree inside the gap', () => {
  /**
   * The generator reads versions; "próxima fecha" and the dashboard projection
   * read the rule's own columns. That is the split that let them drift, and a
   * gap is where drifting becomes visible: one says nothing is owed, another
   * announces a date. Both representations are built here from ONE description
   * of the same rule, and the three answers are compared.
   */
  const CHOSEN = '2026-10-10'
  const versions = [
    { effective_from: '2026-06-08', effective_until: '2026-09-10', ...monthly('2026-06-08') },
    { effective_from: CHOSEN, effective_until: null, ...monthly('2026-06-10') },
  ]
  const asRule = {
    id: 'r1',
    start_date: '2026-06-10',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month' as const,
    max_occurrences: null,
    schedule_effective_from: CHOSEN,
    covered: new Set(['2026-07-08', '2026-08-08', '2026-09-08']),
  }

  const insideTheGap = ['2026-09-11', '2026-09-30', '2026-10-09']

  it.each(insideTheGap)('on %s nobody owes, announces or projects anything', (day) => {
    const owedNow = owedOccurrencesForRule({
      versions,
      pauses: [],
      reconstructFrom: '2026-06-08',
      horizon: '2026-01-01',
      today: day,
      existing: asRule.covered,
      endDate: null,
      maxOccurrences: null,
    })
    expect(owedNow).toEqual([])
    // The next date is the first one of the new schedule, never a date the old
    // calendar would have produced in between.
    expect(getNextExpectedOccurrence(asRule, day, asRule.covered)).toBe(CHOSEN)
    expect(projectRuleOccurrences(asRule, day, '2026-10-09')).toEqual([])
  })

  it('and on the day it starts, the three say the same date', () => {
    const owedNow = owedOccurrencesForRule({
      versions,
      pauses: [],
      reconstructFrom: '2026-06-08',
      horizon: '2026-01-01',
      today: CHOSEN,
      existing: asRule.covered,
      endDate: null,
      maxOccurrences: null,
    })
    expect(owedNow).toEqual([CHOSEN])
    expect(getNextExpectedOccurrence(asRule, CHOSEN, asRule.covered)).toBe(CHOSEN)
    expect(projectRuleOccurrences(asRule, CHOSEN, '2026-10-31')).toEqual([CHOSEN])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The floor a row lands on when nothing decided it.
//
// `schedule_effective_from` is NOT NULL with a fail-closed default, reached only
// when the trigger that fills it is gone, disabled or bypassed. The value was
// chosen to SUPPRESS — a schedule that does not rule yet produces nothing — and
// that has to be true of every reader, not just the one where `from > windowEnd`
// happens to fall out of the arithmetic.
// ═══════════════════════════════════════════════════════════════════════════

describe('a schedule that never starts ruling', () => {
  const unruled = {
    id: 'r1',
    start_date: '2026-06-10',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month' as const,
    max_occurrences: null,
    schedule_effective_from: SCHEDULE_NEVER_RULES,
    covered: [] as string[],
  }

  it('projects nothing', () => {
    expect(projectRuleOccurrences(unruled, '2026-09-01', '2026-09-30')).toEqual([])
  })

  it('announces nothing as próximo, rather than a date in the year 9999', () => {
    expect(getNextExpectedOccurrence(unruled, TODAY, [])).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The cap, after the anchor has moved.
//
// The generator composes versions and counts positions across all of them. The
// other two readers walk the rule's COLUMNS — one anchor, the current one — and
// count the cap from there. While the anchor could not move those were the same
// number. Correcting a reference date moves it, and everything the rule spent
// under its previous anchor stops counting: a three-cuota rule finishes, and the
// screens go on offering a fourth.
// ═══════════════════════════════════════════════════════════════════════════

describe('a rule whose cap ran out before its anchor moved', () => {
  // Three cuotas on the 25th — June, July, August — then corrected to the 25th
  // of September, which is the first date the new schedule would rule.
  const CORRECTED = '2026-09-25'
  const rule = {
    id: 'r-cuotas',
    start_date: CORRECTED,
    end_date: null,
    interval_count: 1,
    interval_unit: 'month' as const,
    max_occurrences: 3,
    schedule_effective_from: CORRECTED,
    schedule_positions_before: 3,
    covered: [] as string[],
  }

  it('owes nothing: the generator counts across both anchors', () => {
    expect(
      owedOccurrencesForRule({
        versions: [
          { effective_from: '2026-06-25', effective_until: '2026-09-10', ...monthly('2026-06-25') },
          { effective_from: CORRECTED, effective_until: null, ...monthly(CORRECTED) },
        ],
        pauses: [],
        // Generation had caught up to the correction, so the three cuotas are
        // behind the floor: what stops the fourth is the cap, not the backlog.
        reconstructFrom: TODAY,
        horizon: '2026-01-01',
        today: TODAY,
        existing: new Set<string>(),
        endDate: null,
        maxOccurrences: 3,
        seedOccurrenceDate: null,
      }),
    ).toEqual([])
  })

  it('announces no próximo either', () => {
    expect(getNextExpectedOccurrence(rule, TODAY, [])).toBeNull()
  })

  it('projects nothing into the window that contains it', () => {
    expect(projectRuleOccurrences(rule, '2026-09-01', '2026-09-30')).toEqual([])
  })
})
