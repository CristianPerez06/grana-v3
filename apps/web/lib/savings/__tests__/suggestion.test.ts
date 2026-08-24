import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SUGGESTION_PCT,
  deriveSuggestedPct,
  deriveSuggestion,
  lastSaveOf,
  shouldOfferSuggestion,
} from '@grana/savings'
import type { ReserveEntry } from '@grana/savings'

/**
 * The post-income suggestion.
 *
 * Two rules carry the whole thing, and both are about NOT being annoying:
 * the amount follows a percentage the user established themselves, and the strip
 * is offered at most once per calendar month.
 */

const entry = (amount: number, date: string): ReserveEntry => ({
  id: `r-${date}-${amount}`,
  currencyCode: 'ARS',
  amount,
  date,
  createdAt: `${date}T12:00:00Z`,
})

describe('deriveSuggestedPct — the percentage comes from what the user did', () => {
  it('is 10% the first time', () => {
    expect(deriveSuggestedPct(null, null)).toBe(DEFAULT_SUGGESTION_PCT)
  })

  it('is the ratio of the last save over that month income', () => {
    expect(deriveSuggestedPct(entry(200_000, '2026-08-05'), 2_000_000)).toBeCloseTo(0.1, 10)
    expect(deriveSuggestedPct(entry(600_000, '2026-08-05'), 2_000_000)).toBeCloseTo(0.3, 10)
  })

  it('falls back to 10% when the ratio comes out absurd', () => {
    // A month with a save and no registered income would otherwise produce a
    // percentage nobody would accept, and the next suggestion would be noise.
    expect(deriveSuggestedPct(entry(100_000, '2026-08-05'), 0)).toBe(DEFAULT_SUGGESTION_PCT)
    expect(deriveSuggestedPct(entry(100_000, '2026-08-05'), null)).toBe(DEFAULT_SUGGESTION_PCT)
    expect(deriveSuggestedPct(entry(1_900_000, '2026-08-05'), 2_000_000)).toBe(DEFAULT_SUGGESTION_PCT)
    expect(deriveSuggestedPct(entry(1_000, '2026-08-05'), 2_000_000)).toBe(DEFAULT_SUGGESTION_PCT)
  })

  it('ignores a release when looking for the last save', () => {
    const history = [entry(-50_000, '2026-08-18'), entry(200_000, '2026-08-05')]
    expect(lastSaveOf(history)).toEqual(entry(200_000, '2026-08-05'))
  })
})

describe('deriveSuggestion — the amount', () => {
  it('remembers the percentage, not the amount', () => {
    // 10% of $2.000.000 in August suggests $250.000 over $2.500.000 in September.
    const suggestion = deriveSuggestion({
      monthIncome: 2_500_000,
      lastSave: entry(200_000, '2026-08-05'),
      incomeAtLastSave: 2_000_000,
      available: 3_000_000,
    })
    expect(suggestion?.amount).toBe(250_000)
  })

  it('suggests 10% for someone who never saved', () => {
    const suggestion = deriveSuggestion({
      monthIncome: 2_000_000,
      lastSave: null,
      incomeAtLastSave: null,
      available: 2_000_000,
    })
    expect(suggestion).toEqual({ amount: 200_000, pct: 0.1 })
  })

  it('never proposes more than what is available', () => {
    // The strip must not propose something the write path will reject: that is
    // the worst possible moment for Grana to lose credibility.
    const suggestion = deriveSuggestion({
      monthIncome: 2_000_000,
      lastSave: null,
      incomeAtLastSave: null,
      available: 80_000,
    })
    expect(suggestion?.amount).toBe(80_000)
  })

  it('stays quiet when there is nothing to propose', () => {
    const base = { lastSave: null, incomeAtLastSave: null }
    // No income this month: there is no moment to attach to.
    expect(deriveSuggestion({ ...base, monthIncome: 0, available: 500_000 })).toBeNull()
    // Nothing available: proposing to set aside money that is not there.
    expect(deriveSuggestion({ ...base, monthIncome: 2_000_000, available: 0 })).toBeNull()
    expect(deriveSuggestion({ ...base, monthIncome: 2_000_000, available: -50_000 })).toBeNull()
  })
})

describe('shouldOfferSuggestion — at most once a month, and never after a dismissal', () => {
  it('offers it to someone who has never seen it', () => {
    expect(
      shouldOfferSuggestion({ seenAt: null, dismissedAt: null, currentMonth: '2026-08' }),
    ).toBe(true)
  })

  it('does not offer it twice in the same month', () => {
    // Two incomes in one month (a quincena, a bonus) get one strip, not two.
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:00Z',
        dismissedAt: null,
        currentMonth: '2026-08',
      }),
    ).toBe(false)
  })

  it('comes back on its own the next month', () => {
    // Which is why being shown marks `seen` and never `completed`: completing it
    // would kill a recurring suggestion forever.
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:00Z',
        dismissedAt: null,
        currentMonth: '2026-09',
      }),
    ).toBe(true)
  })

  it('stays gone once dismissed, in any month', () => {
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:00Z',
        dismissedAt: '2026-08-05T10:00:05Z',
        currentMonth: '2026-12',
      }),
    ).toBe(false)
  })
})
