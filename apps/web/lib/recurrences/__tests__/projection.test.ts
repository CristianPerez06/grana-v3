import { describe, expect, it } from 'vitest'
import {
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
