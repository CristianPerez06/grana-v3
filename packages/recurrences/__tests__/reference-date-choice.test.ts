import { describe, expect, it } from 'vitest'
import { referenceDateChoice } from '../src'

/**
 * What the form asks — the one decision, shared by web and native so the two
 * cannot answer it differently.
 */

const TODAY = '2026-09-10'
const monthlyRule = (over: Partial<Parameters<typeof referenceDateChoice>[0]> = {}) => ({
  status: 'active',
  interval_count: 1,
  interval_unit: 'month' as const,
  end_date: null,
  max_occurrences: null,
  positionsSpent: 3,
  ...over,
})

describe('an active rule is asked', () => {
  it('offers the next two occurrences of the corrected schedule', () => {
    expect(referenceDateChoice(monthlyRule(), '2026-06-10', TODAY)).toEqual({
      kind: 'ask',
      options: ['2026-09-10', '2026-10-10'],
    })
  })

  it('offers dates, not periods, for a rule every three days', () => {
    // The reason the question is phrased with dates: this rule has no "month" to
    // start from, and no period to rule "from the next one".
    expect(
      referenceDateChoice(
        monthlyRule({ interval_count: 3, interval_unit: 'day' }),
        '2026-09-02',
        TODAY,
      ),
    ).toEqual({ kind: 'ask', options: ['2026-09-11', '2026-09-14'] })
  })
})

describe('a paused rule is not asked', () => {
  it('says the reference will be used on resume', () => {
    // Both candidates would fall inside the pause. Calling either "the first
    // occurrence" would be a promise the calendar is not going to keep.
    expect(referenceDateChoice(monthlyRule({ status: 'paused' }), '2026-06-10', TODAY)).toEqual({
      kind: 'paused',
    })
  })
})

describe('a rule with nothing left is not asked either', () => {
  it('has no candidate past its end date', () => {
    expect(
      referenceDateChoice(monthlyRule({ end_date: '2026-08-01' }), '2026-06-10', TODAY),
    ).toEqual({ kind: 'exhausted' })
  })

  it('has no candidate once the cap is spent', () => {
    expect(
      referenceDateChoice(
        monthlyRule({ max_occurrences: 3, positionsSpent: 3 }),
        '2026-06-10',
        TODAY,
      ),
    ).toEqual({ kind: 'exhausted' })
  })

  it('offers only one when only one is left', () => {
    expect(
      referenceDateChoice(
        monthlyRule({ max_occurrences: 4, positionsSpent: 3 }),
        '2026-06-10',
        TODAY,
      ),
    ).toEqual({ kind: 'ask', options: ['2026-09-10'] })
  })
})
