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
