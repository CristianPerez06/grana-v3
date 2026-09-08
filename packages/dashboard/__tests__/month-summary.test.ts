import { describe, expect, it } from 'vitest'
import { deriveMonthSummary } from '../src/month-summary'
import type { MonthBalanceSeries } from '../src/types'

const series = (overrides: Partial<MonthBalanceSeries> = {}): MonthBalanceSeries => {
  const base = {
    year: 2026,
    month: 8,
    days: [],
    totalIncome: 0,
    totalFinancialIncome: 0,
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

const EMPTY_SUMMARY = {
  entro: 0,
  seFue: 0,
  entroParts: { ingresos: 0, ingresosFinancieros: 0, devoluciones: 0, otros: 0 },
  seFueParts: { gastos: 0, pagosDeTarjeta: 0, otros: 0 },
}

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

    expect(summary.ARS).toEqual({
      entro: 20_000,
      seFue: 81_303,
      entroParts: { ingresos: 20_000, ingresosFinancieros: 0, devoluciones: 0, otros: 0 },
      seFueParts: { gastos: 81_303, pagosDeTarjeta: 0, otros: 0 },
    })
    expect(summary.USD).toEqual(EMPTY_SUMMARY)
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
      ARS: EMPTY_SUMMARY,
      USD: EMPTY_SUMMARY,
    })
  })

  it('summarizes each currency from its own series', () => {
    const summary = deriveMonthSummary(
      bimoneda(
        { totalIncome: 500_000, totalExpense: 120_000 },
        { totalIncome: 300, totalExpense: 45, totalCardPayment: 20 },
      ),
    )

    expect(summary.ARS).toEqual({
      entro: 500_000,
      seFue: 120_000,
      entroParts: { ingresos: 500_000, ingresosFinancieros: 0, devoluciones: 0, otros: 0 },
      seFueParts: { gastos: 120_000, pagosDeTarjeta: 0, otros: 0 },
    })
    expect(summary.USD).toEqual({
      entro: 300,
      seFue: 65,
      entroParts: { ingresos: 300, ingresosFinancieros: 0, devoluciones: 0, otros: 0 },
      seFueParts: { gastos: 45, pagosDeTarjeta: 20, otros: 0 },
    })
  })

  // The card can OPEN each total by concept, and promises the rows it lists add
  // up to the total above them. That promise is the contract here.
  describe('the concepts behind each total', () => {
    it('splits what came in into earned, returned and the rest', () => {
      const { ARS } = deriveMonthSummary(
        bimoneda({
          totalIncome: 2_929_111.22,
          totalReimbursement: 446_002.12,
          totalSettlement: 5_000,
        }),
      )

      expect(ARS.entroParts).toEqual({
        ingresos: 2_929_111.22,
        ingresosFinancieros: 0,
        devoluciones: 446_002.12,
        otros: 5_000,
      })
      expect(ARS.entro).toBe(3_380_113.34)
    })

    it('splits the yields out of income without adding them on top', () => {
      // August 2026: 2.929.111,22 of income, of which 131.431,22 was interest
      // filed under "Financiero". The two rows are 2.797.680 and 131.431,22 —
      // and the total is still what it always was.
      const { ARS } = deriveMonthSummary(
        bimoneda({ totalIncome: 2_929_111.22, totalFinancialIncome: 131_431.22 }),
      )

      expect(ARS.entroParts.ingresos).toBe(2_797_680)
      expect(ARS.entroParts.ingresosFinancieros).toBe(131_431.22)
      expect(ARS.entro).toBe(2_929_111.22)
    })

    it('leaves every income under "Ingresos" when none was filed as financial', () => {
      const { ARS } = deriveMonthSummary(bimoneda({ totalIncome: 500_000 }))

      expect(ARS.entroParts.ingresos).toBe(500_000)
      expect(ARS.entroParts.ingresosFinancieros).toBe(0)
    })

    it('splits what went out into spending, statement payments and the rest', () => {
      const { ARS } = deriveMonthSummary(
        bimoneda({
          totalExpense: 1_592_094.4,
          totalCardPayment: 968_558.83,
          totalExchange: -1_000,
        }),
      )

      expect(ARS.seFueParts).toEqual({
        gastos: 1_592_094.4,
        pagosDeTarjeta: 968_558.83,
        otros: 1_000,
      })
      expect(ARS.seFue).toBe(2_561_653.23)
    })

    it('sends each signed bucket to the side its sign puts it on, in the parts too', () => {
      const { ARS } = deriveMonthSummary(
        bimoneda({ totalSettlement: 30_000, totalAdjustment: -12_500 }),
      )

      expect(ARS.entroParts.otros).toBe(30_000)
      expect(ARS.seFueParts.otros).toBe(12_500)
    })

    it('leaves "otros" at zero in the ordinary month, so the row can be dropped', () => {
      const { ARS } = deriveMonthSummary(bimoneda({ totalIncome: 100, totalExpense: 40 }))

      expect(ARS.entroParts.otros).toBe(0)
      expect(ARS.seFueParts.otros).toBe(0)
    })

    it('keeps each total the exact sum of its parts, cents included', () => {
      // Thirds of a peso: added as floats these drift, and a card whose rows do
      // not add up to the total above them is a wrong read.
      const { ARS } = deriveMonthSummary(
        bimoneda({
          totalIncome: 0.1,
          totalReimbursement: 0.1,
          totalSettlement: 0.1,
          totalExpense: 0.7,
          totalCardPayment: 0.1,
          totalExchange: -0.1,
        }),
      )

      expect(ARS.entro).toBe(0.3)
      expect(ARS.seFue).toBe(0.9)
    })
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
