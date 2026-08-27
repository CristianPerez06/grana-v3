import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SUGGESTION_PCT,
  deriveSuggestedPct,
  deriveSuggestion,
  lastSaveOf,
  pickLatestIncome,
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
      latestIncome: 2_500_000,
      lastSave: entry(200_000, '2026-08-05'),
      incomeAtLastSave: 2_000_000,
      available: 3_000_000,
    })
    expect(suggestion?.amount).toBe(250_000)
  })

  it('suggests 10% for someone who never saved', () => {
    const suggestion = deriveSuggestion({
      latestIncome: 2_000_000,
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
      latestIncome: 2_000_000,
      lastSave: null,
      incomeAtLastSave: null,
      available: 80_000,
    })
    expect(suggestion?.amount).toBe(80_000)
  })

  it('stays quiet when there is nothing to propose', () => {
    const base = { lastSave: null, incomeAtLastSave: null }
    // No income this month: there is no moment to attach to.
    expect(deriveSuggestion({ ...base, latestIncome: 0, available: 500_000 })).toBeNull()
    // Nothing available: proposing to set aside money that is not there.
    expect(deriveSuggestion({ ...base, latestIncome: 2_000_000, available: 0 })).toBeNull()
    expect(deriveSuggestion({ ...base, latestIncome: 2_000_000, available: -50_000 })).toBeNull()
  })
})

describe('shouldOfferSuggestion — once per income, with an opt-in monthly cap', () => {
  const INCOME_1 = '2026-08-05T10:00:00Z'
  const INCOME_2 = '2026-08-20T10:00:00Z'

  it('offers it to someone who has never seen it', () => {
    expect(
      shouldOfferSuggestion({
        seenAt: null,
        dismissedAt: null,
        currentMonth: '2026-08',
        latestIncomeAt: INCOME_1,
      }),
    ).toBe(true)
  })

  it('does not repeat itself for the SAME income', () => {
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:05Z',
        dismissedAt: null,
        currentMonth: '2026-08',
        latestIncomeAt: INCOME_1,
      }),
    ).toBe(false)
  })

  it('comes back with the NEXT income, same month', () => {
    // A quincena is two paychecks and therefore two decisions. Offering only the
    // first one misses half the moments the strip exists for.
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:05Z',
        dismissedAt: null,
        currentMonth: '2026-08',
        latestIncomeAt: INCOME_2,
      }),
    ).toBe(true)
  })

  it('stays quiet for the rest of the month after "No este mes"', () => {
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:05Z',
        dismissedAt: '2026-08-05T10:00:05Z',
        currentMonth: '2026-08',
        latestIncomeAt: INCOME_2,
      }),
    ).toBe(false)
  })

  it('comes back next month after "No este mes"', () => {
    // The monthly cap is opt-in, not permanent: the slowest the strip can go is
    // once a month, so there is nothing left worth killing for good — and a
    // one-tap permanent off would get pressed by accident.
    expect(
      shouldOfferSuggestion({
        seenAt: '2026-08-05T10:00:05Z',
        dismissedAt: '2026-08-05T10:00:05Z',
        currentMonth: '2026-09',
        latestIncomeAt: '2026-09-03T10:00:00Z',
      }),
    ).toBe(true)
  })

  it('says nothing when the month has no income', () => {
    expect(
      shouldOfferSuggestion({
        seenAt: null,
        dismissedAt: null,
        currentMonth: '2026-08',
        latestIncomeAt: null,
      }),
    ).toBe(false)
  })
})

/**
 * Qué moneda ofrece la tira.
 *
 * Antes no era una pregunta: la tira solo miraba pesos, así que un ingreso en
 * dólares no la despertaba nunca. Estos casos son el bug que eso era.
 */
describe('pickLatestIncome', () => {
  const income = (createdAt: string, amount = 1000) => ({ amount, createdAt })

  it('ofrece la moneda del ingreso que se cargó último', () => {
    expect(
      pickLatestIncome(income('2026-08-01T10:00:00Z'), income('2026-08-01T11:00:00Z', 900)),
    ).toEqual({ currency: 'USD', income: income('2026-08-01T11:00:00Z', 900) })

    expect(
      pickLatestIncome(income('2026-08-02T09:00:00Z'), income('2026-08-01T11:00:00Z', 900)),
    ).toEqual({ currency: 'ARS', income: income('2026-08-02T09:00:00Z') })
  })

  it('un ingreso en dólares despierta la tira aunque no haya ninguno en pesos', () => {
    expect(pickLatestIncome(null, income('2026-08-01T11:00:00Z', 900))).toEqual({
      currency: 'USD',
      income: income('2026-08-01T11:00:00Z', 900),
    })
  })

  it('sin ingresos no hay tira', () => {
    expect(pickLatestIncome(null, null)).toBeNull()
  })

  it('compara el momento de CARGA, no la fecha contable', () => {
    // El de dólares se cargó después aunque su fecha sea anterior: la tira
    // persigue "el que acabás de cargar".
    const ars = { amount: 500000, createdAt: '2026-08-10T08:00:00Z' }
    const usd = { amount: 900, createdAt: '2026-08-10T08:00:01Z' }
    expect(pickLatestIncome(ars, usd)?.currency).toBe('USD')
  })

  it('ante el empate exacto la elección es estable', () => {
    const at = '2026-08-10T08:00:00Z'
    const first = pickLatestIncome({ amount: 1, createdAt: at }, { amount: 2, createdAt: at })
    const second = pickLatestIncome({ amount: 1, createdAt: at }, { amount: 2, createdAt: at })
    expect(first).toEqual(second)
    expect(first?.currency).toBe('ARS')
  })
})
