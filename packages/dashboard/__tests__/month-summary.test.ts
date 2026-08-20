import { describe, expect, it } from 'vitest'
import { deriveMonthSummary } from '../src/month-summary'
import type { MonthBalanceSeries } from '../src/types'

const series = (overrides: Partial<MonthBalanceSeries> = {}): MonthBalanceSeries => {
  const base = {
    year: 2026,
    month: 8,
    days: [],
    totalIncome: 0,
    totalExpense: 0,
    totalAdjustment: 0,
    totalCardPayment: 0,
    totalReimbursement: 0,
    totalSettlement: 0,
    totalExchange: 0,
    totalTransfer: 0,
    ...overrides,
  }
  // `finalBalance` is not free input: it is what the buckets add up to, with the
  // same sign rules the balance read uses. Deriving it here keeps every fixture
  // internally consistent, so the reconciliation test cannot pass by accident.
  return {
    ...base,
    finalBalance:
      base.totalIncome -
      base.totalExpense -
      base.totalCardPayment +
      base.totalAdjustment +
      base.totalReimbursement +
      base.totalSettlement +
      base.totalExchange +
      base.totalTransfer,
  }
}

const bimoneda = (ars: Partial<MonthBalanceSeries>, usd: Partial<MonthBalanceSeries> = {}) => ({
  ARS: series(ars),
  USD: series(usd),
})

describe('deriveMonthSummary', () => {
  it('adds received reimbursements to what came in', () => {
    const summary = deriveMonthSummary(bimoneda({ totalIncome: 20_000, totalReimbursement: 5_000 }))

    expect(summary.ARS.entro).toBe(25_000)
  })

  it('adds card statement payments to what went out', () => {
    // Paying the statement is real money leaving the account. Card PURCHASES are
    // absent by construction: they are off-ledger and never reach these totals.
    const summary = deriveMonthSummary(bimoneda({ totalExpense: 52_400, totalCardPayment: 28_903 }))

    expect(summary.ARS.seFue).toBe(81_303)
  })

  it('keeps the two currencies apart', () => {
    const summary = deriveMonthSummary(bimoneda({ totalIncome: 20_000, totalExpense: 81_303 }))

    expect(summary.ARS).toEqual({ entro: 20_000, seFue: 81_303 })
    expect(summary.USD).toEqual({ entro: 0, seFue: 0 })
  })

  it('puts each signed bucket on the side its sign puts it', () => {
    const summary = deriveMonthSummary(
      bimoneda({
        totalIncome: 10_000,
        totalExpense: 4_000,
        totalAdjustment: -3_000, // out
        totalSettlement: 2_000, // in
        totalExchange: -1_500, // out
        totalTransfer: 700, // in
      }),
    )

    expect(summary.ARS.entro).toBe(12_700) // 10.000 + 2.000 + 700
    expect(summary.ARS.seFue).toBe(8_500) // 4.000 + 3.000 + 1.500
  })

  it('returns zeros for a month with no movements', () => {
    expect(deriveMonthSummary(bimoneda({}))).toEqual({
      ARS: { entro: 0, seFue: 0 },
      USD: { entro: 0, seFue: 0 },
    })
  })

  it('summarizes each currency from its own series', () => {
    const summary = deriveMonthSummary(
      bimoneda(
        { totalIncome: 500_000, totalExpense: 120_000 },
        { totalIncome: 300, totalExpense: 45, totalCardPayment: 20 },
      ),
    )

    expect(summary.ARS).toEqual({ entro: 500_000, seFue: 120_000 })
    expect(summary.USD).toEqual({ entro: 300, seFue: 65 })
  })

  // THE invariant of this card: it reads as liquidity, so the two amounts have
  // to close against the month's change in available balance. If this breaks,
  // the card is showing two numbers nobody can verify.
  describe('entro − seFue reconciles with finalBalance', () => {
    const cases: Array<[string, Partial<MonthBalanceSeries>]> = [
      ['only income', { totalIncome: 850_000 }],
      ['only expense', { totalExpense: 412_000 }],
      ['income and expense', { totalIncome: 850_000, totalExpense: 412_000 }],
      ['with a statement payment', { totalIncome: 100_000, totalCardPayment: 388_873 }],
      ['with a reimbursement', { totalExpense: 9_000, totalReimbursement: 3_500 }],
      ['with a negative adjustment', { totalIncome: 5_000, totalAdjustment: -1_200 }],
      ['with a positive adjustment', { totalExpense: 5_000, totalAdjustment: 1_200 }],
      ['with settlements both ways', { totalSettlement: -4_400, totalIncome: 1_000 }],
      ['with a currency exchange leg', { totalExchange: -250_000, totalIncome: 10_000 }],
      ['with a cross-boundary transfer', { totalTransfer: -33_000 }],
      [
        'everything at once',
        {
          totalIncome: 850_000,
          totalExpense: 412_000,
          totalCardPayment: 388_873,
          totalReimbursement: 12_500,
          totalAdjustment: -7_300,
          totalSettlement: 4_400,
          totalExchange: -250_000,
          totalTransfer: 1_100,
        },
      ],
      ['with cents', { totalIncome: 1_234.56, totalExpense: 789.01, totalAdjustment: -0.55 }],
    ]

    it.each(cases)('%s', (_name, overrides) => {
      const input = series(overrides)
      const { entro, seFue } = deriveMonthSummary({ ARS: input, USD: series() }).ARS

      expect(entro - seFue).toBeCloseTo(input.finalBalance, 10)
    })
  })
})
