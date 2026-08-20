import { describe, expect, it } from 'vitest'
import { deriveMonthSummary } from '../src/month-summary'
import type { MonthBalanceSeries } from '../src/types'

const series = (overrides: Partial<MonthBalanceSeries> = {}): MonthBalanceSeries => ({
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
  finalBalance: 0,
  ...overrides,
})

const bimoneda = (ars: Partial<MonthBalanceSeries>, usd: Partial<MonthBalanceSeries> = {}) => ({
  ARS: series(ars),
  USD: series(usd),
})

describe('deriveMonthSummary', () => {
  it('adds received reimbursements to what came in', () => {
    // A reimbursement is cash back in the account; leaving it out would make the
    // summary disagree with the change in the available balance.
    const summary = deriveMonthSummary(bimoneda({ totalIncome: 20_000, totalReimbursement: 5_000 }))

    expect(summary.ARS.entro).toBe(25_000)
  })

  it('adds card statement payments to what went out', () => {
    // The statement payment is not new spending, but it IS money leaving the
    // account this month.
    const summary = deriveMonthSummary(
      bimoneda({ totalExpense: 52_400, totalCardPayment: 28_903 }),
    )

    expect(summary.ARS.seFue).toBe(81_303)
  })

  it('keeps the two currencies apart', () => {
    const summary = deriveMonthSummary(
      { ...bimoneda({ totalIncome: 20_000, totalExpense: 81_303 }) },
      )

    expect(summary.ARS).toEqual({ entro: 20_000, seFue: 81_303 })
    expect(summary.USD).toEqual({ entro: 0, seFue: 0 })
  })

  it('excludes the signed buckets from both headlines', () => {
    // Adjustments, settlements and currency exchange move the balance but are
    // not what the user reads as "entró" / "se fue".
    const summary = deriveMonthSummary(
      bimoneda({
        totalIncome: 10_000,
        totalExpense: 4_000,
        totalAdjustment: -3_000,
        totalSettlement: 2_000,
        totalExchange: -1_500,
        totalTransfer: 700,
      }),
    )

    expect(summary.ARS).toEqual({ entro: 10_000, seFue: 4_000 })
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
})
