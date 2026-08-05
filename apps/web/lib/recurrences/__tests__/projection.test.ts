import { describe, expect, it } from 'vitest'
import {
  getNextExpectedOccurrence,
  projectRuleOccurrences,
  projectUpcomingOccurrences,
  type RuleForProjection,
} from '@grana/money-logic'

const monthly = (overrides: Partial<RuleForProjection> = {}): RuleForProjection => ({
  id: 'r1',
  start_date: '2026-06-01',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  last_generated_date: null,
  ...overrides,
})

describe('projectRuleOccurrences', () => {
  it('returns occurrences within the window, inclusive of both ends', () => {
    // Monthly from Jun 1; window Jun 1 → Aug 1 ⇒ Jun 1, Jul 1, Aug 1.
    const out = projectRuleOccurrences(monthly(), '2026-06-01', '2026-08-01')
    expect(out).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
  })

  it('skips occurrences before the window start', () => {
    // Window opens Jul 1, so Jun 1 is excluded.
    const out = projectRuleOccurrences(monthly(), '2026-07-01', '2026-09-30')
    expect(out).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
  })

  it('stops at end_date', () => {
    const out = projectRuleOccurrences(
      monthly({ end_date: '2026-07-15' }),
      '2026-06-01',
      '2026-12-31',
    )
    expect(out).toEqual(['2026-06-01', '2026-07-01'])
  })

  it('stops at max_occurrences regardless of window', () => {
    const out = projectRuleOccurrences(
      monthly({ max_occurrences: 2 }),
      '2026-06-01',
      '2026-12-31',
    )
    expect(out).toEqual(['2026-06-01', '2026-07-01'])
  })

  it('clamps end-of-month for a rule starting on the 31st', () => {
    const out = projectRuleOccurrences(
      monthly({ start_date: '2026-01-31' }),
      '2026-01-01',
      '2026-04-30',
    )
    // Jan 31 → Feb 28 (clamp) → Mar 31 (anchor restored) → Apr 30 (clamp).
    expect(out).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('returns empty when the whole series is past the window', () => {
    const out = projectRuleOccurrences(
      monthly({ start_date: '2027-01-01' }),
      '2026-06-01',
      '2026-06-30',
    )
    expect(out).toEqual([])
  })

  it('handles a weekly custom interval', () => {
    const out = projectRuleOccurrences(
      monthly({ start_date: '2026-06-01', interval_count: 2, interval_unit: 'week' }),
      '2026-06-01',
      '2026-06-30',
    )
    expect(out).toEqual(['2026-06-01', '2026-06-15', '2026-06-29'])
  })
})

describe('getNextExpectedOccurrence', () => {
  it('returns the same day when today IS an occurrence and nothing is confirmed yet', () => {
    // Monthly on the 1st, today Jun 1, no cursor ⇒ próximo = Jun 1 (fires today).
    expect(getNextExpectedOccurrence(monthly(), '2026-06-01', null)).toBe('2026-06-01')
  })

  it('rolls forward past occurrences — a past start_date does NOT surface as próximo', () => {
    // Monthly on day 19, today Jun 23, no cursor ⇒ Jun 19 passed ⇒ próximo = Jul 19.
    expect(
      getNextExpectedOccurrence(monthly({ start_date: '2026-05-19' }), '2026-06-23', null),
    ).toBe('2026-07-19')
  })

  it('rolls past today when today\'s occurrence is already the cursor (seeded/confirmed)', () => {
    // The real Epe case: movement loaded TODAY (Jun 23) marked monthly. The seed
    // covers Jun 23 (last_generated_date = Jun 23), so próximo = Jul 23, not today.
    expect(
      getNextExpectedOccurrence(monthly({ start_date: '2026-06-23' }), '2026-06-23', '2026-06-23'),
    ).toBe('2026-07-23')
  })

  it('returns today when the cursor is an older occurrence and today is due', () => {
    // Confirmed last month (cursor May 23); today Jun 23 is the next, still due.
    expect(
      getNextExpectedOccurrence(monthly({ start_date: '2026-05-23' }), '2026-06-23', '2026-05-23'),
    ).toBe('2026-06-23')
  })

  it('returns start_date when the rule starts in the future', () => {
    expect(
      getNextExpectedOccurrence(monthly({ start_date: '2026-09-10' }), '2026-06-23', null),
    ).toBe('2026-09-10')
  })

  it('returns null when end_date is before the next occurrence', () => {
    expect(
      getNextExpectedOccurrence(
        monthly({ start_date: '2026-01-19', end_date: '2026-06-01' }),
        '2026-06-23',
        null,
      ),
    ).toBeNull()
  })

  it('returns null when max_occurrences is exhausted before today', () => {
    // 2 occurrences (Jan 19, Feb 19), both past today ⇒ no further occurrence.
    expect(
      getNextExpectedOccurrence(
        monthly({ start_date: '2026-01-19', max_occurrences: 2 }),
        '2026-06-23',
        null,
      ),
    ).toBeNull()
  })

  it('honors end-of-month clamping when rolling forward', () => {
    // Monthly on the 31st, today Mar 1 ⇒ próximo = Mar 31 (Feb clamps to 28).
    expect(
      getNextExpectedOccurrence(monthly({ start_date: '2026-01-31' }), '2026-03-01', null),
    ).toBe('2026-03-31')
  })
})

describe('projectRuleOccurrences — cursor (last_generated_date)', () => {
  it('does NOT project an occurrence already covered by the seed movement', () => {
    // The real case: a movement loaded on Aug 4 marked "Recurrente" seeds the
    // rule (last_generated_date = Aug 4). Announcing Aug 4 as upcoming would
    // draw a gasto the user already registered.
    const out = projectRuleOccurrences(
      monthly({ start_date: '2026-08-04', last_generated_date: '2026-08-04' }),
      '2026-08-04',
      '2026-08-11',
    )
    expect(out).toEqual([])
  })

  it('projects start_date for a direct rule with nothing materialized', () => {
    const out = projectRuleOccurrences(
      monthly({ start_date: '2026-08-07', last_generated_date: null }),
      '2026-08-04',
      '2026-08-11',
    )
    expect(out).toEqual(['2026-08-07'])
  })

  it('skips an occurrence whose cursor sits in the future, and finds the next one', () => {
    // The orphaned-zombie shape: cursor on a future date whose seed movement was
    // deleted. The rule cannot fire on Aug 7 — it must not be drawn as upcoming.
    const rule = monthly({ start_date: '2026-08-07', last_generated_date: '2026-08-07' })
    expect(projectRuleOccurrences(rule, '2026-08-04', '2026-08-31')).toEqual([])
    expect(projectRuleOccurrences(rule, '2026-08-04', '2026-09-30')).toEqual(['2026-09-07'])
  })

  it('still projects occurrences past the cursor', () => {
    const out = projectRuleOccurrences(
      monthly({ start_date: '2026-06-05', last_generated_date: '2026-07-05' }),
      '2026-08-01',
      '2026-09-30',
    )
    expect(out).toEqual(['2026-08-05', '2026-09-05'])
  })
})

describe('projection and próximo cannot diverge', () => {
  // The defect this guards: projectRuleOccurrences and getNextExpectedOccurrence
  // used to walk the calendar independently, and one ignored the cursor. They
  // now share one walker; this asserts they keep agreeing.
  const cases: RuleForProjection[] = [
    monthly({ id: 'a', start_date: '2026-08-04', last_generated_date: '2026-08-04' }),
    monthly({ id: 'b', start_date: '2026-08-07', last_generated_date: null }),
    monthly({ id: 'c', start_date: '2026-08-07', last_generated_date: '2026-08-07' }),
    monthly({ id: 'd', start_date: '2026-06-05', last_generated_date: '2026-07-05' }),
    monthly({ id: 'e', start_date: '2026-01-31', last_generated_date: '2026-01-31' }),
    monthly({ id: 'f', start_date: '2026-06-01', interval_count: 2, interval_unit: 'week', last_generated_date: '2026-07-27' }),
    monthly({ id: 'g', start_date: '2026-05-01', end_date: '2026-08-01', last_generated_date: '2026-07-01' }),
    monthly({ id: 'h', start_date: '2026-05-01', max_occurrences: 2, last_generated_date: '2026-05-01' }),
  ]

  it.each(cases.map((r) => [r.id, r] as const))(
    'rule %s: the first projected occurrence is the next expected one',
    (_id, rule) => {
      const today = '2026-08-04'
      // A wide window so the projection is not truncated by its upper bound.
      const [firstProjected] = projectRuleOccurrences(rule, today, '2028-12-31')
      const next = getNextExpectedOccurrence(rule, today, rule.last_generated_date)
      expect(firstProjected ?? null).toBe(next)
    },
  )
})

describe('projectUpcomingOccurrences', () => {
  it('merges multiple rules sorted by date', () => {
    const rules: RuleForProjection[] = [
      monthly({ id: 'salary', start_date: '2026-06-01' }),
      monthly({ id: 'rent', start_date: '2026-06-05' }),
    ]
    const out = projectUpcomingOccurrences(rules, '2026-06-01', '2026-06-30')
    expect(out).toEqual([
      { rule_id: 'salary', scheduled_date: '2026-06-01' },
      { rule_id: 'rent', scheduled_date: '2026-06-05' },
    ])
  })

  it('returns empty for no rules', () => {
    expect(projectUpcomingOccurrences([], '2026-06-01', '2026-06-30')).toEqual([])
  })
})
