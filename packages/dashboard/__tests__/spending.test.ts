import { describe, expect, it } from 'vitest'
import {
  deriveCommittedSplit,
  deriveMonthSpending,
  deriveSpendingPace,
  PACE_OVERFLOW_PCT,
} from '../src/spending'
import { aggregateCardDebtByCard } from '../src/aggregations'

describe('deriveMonthSpending', () => {
  it('splits the month expense into paid and still-on-card', () => {
    const spending = deriveMonthSpending(441_273, 52_400)

    expect(spending).toEqual({ gastaste: 441_273, pagaste: 52_400, teQuedaPorPagar: 388_873 })
  })

  it('keeps the three reconciling', () => {
    const { gastaste, pagaste, teQuedaPorPagar } = deriveMonthSpending(1_000.55, 400.2)

    expect(Math.round((pagaste + teQuedaPorPagar) * 100) / 100).toBe(gastaste)
  })

  it('reports zero to pay when nothing went on a card', () => {
    expect(deriveMonthSpending(52_400, 52_400)).toEqual({
      gastaste: 52_400,
      pagaste: 52_400,
      teQuedaPorPagar: 0,
    })
  })

  it('caps paid at the accrued total instead of going negative', () => {
    // The two amounts come from separate reads and can disagree transiently.
    // A negative "te queda por pagar" would render as a nonsense amount.
    const spending = deriveMonthSpending(100, 250)

    expect(spending.pagaste).toBe(100)
    expect(spending.teQuedaPorPagar).toBe(0)
  })

  it('returns zeros for a month with no expense', () => {
    expect(deriveMonthSpending(0, 0)).toEqual({ gastaste: 0, pagaste: 0, teQuedaPorPagar: 0 })
  })
})

describe('deriveSpendingPace', () => {
  it('computes the ratio when income came in', () => {
    const pace = deriveSpendingPace(440_000, 4_000_000)

    expect(pace).toEqual({
      status: 'ok',
      pct: 11,
      fillPct: 11,
      spent: 440_000,
      income: 4_000_000,
    })
  })

  it('is indeterminate before any income lands, not zero percent', () => {
    // Start of the month, before the salary: there is no denominator. Reporting
    // 0% would say "you spent nothing", which is the opposite of the truth.
    const pace = deriveSpendingPace(120_000, 0)

    expect(pace.status).toBe('indeterminate')
    expect(pace).not.toHaveProperty('pct')
  })

  it('flags spending above income and caps the fill at 100', () => {
    const pace = deriveSpendingPace(300_000, 100_000)

    expect(pace).toEqual({
      status: 'over',
      pct: 300,
      fillPct: 100,
      spent: 300_000,
      income: 100_000,
    })
  })

  it('treats exactly 100% as ok, not over', () => {
    const pace = deriveSpendingPace(50_000, 50_000)

    expect(pace.status).toBe('ok')
  })

  it('never divides by a negative income', () => {
    expect(deriveSpendingPace(1_000, -5).status).toBe('indeterminate')
  })

  it('reports zero percent when income came in and nothing was spent', () => {
    const pace = deriveSpendingPace(0, 80_000)

    expect(pace.status).toBe('ok')
    expect(pace).toMatchObject({ pct: 0, fillPct: 0 })
  })
})

describe('deriveCommittedSplit', () => {
  it('derives the two shares from the total', () => {
    const split = deriveCommittedSplit(812_300, 472_200)

    expect(split.total).toBe(1_284_500)
    expect(Math.round(split.cardsPct * 10) / 10).toBe(63.2)
    expect(Math.round(split.recurringPct * 10) / 10).toBe(36.8)
    expect(split.hasBar).toBe(true)
  })

  it('gives the whole bar to the only kind of commitment there is', () => {
    const split = deriveCommittedSplit(0, 472_200)

    expect(split.cardsPct).toBe(0)
    expect(split.recurringPct).toBe(100)
  })

  it('renders no bar when nothing is committed', () => {
    // A stacked bar out of a zero total would need invented proportions.
    expect(deriveCommittedSplit(0, 0)).toEqual({
      total: 0,
      cards: 0,
      recurring: 0,
      cardsPct: 0,
      recurringPct: 0,
      hasBar: false,
    })
  })

  it('adds up to 100 percent', () => {
    const split = deriveCommittedSplit(333, 667)

    expect(Math.round(split.cardsPct + split.recurringPct)).toBe(100)
  })
})

describe('aggregateCardDebtByCard', () => {
  const tx = (over: Partial<Record<string, unknown>> = {}) => ({
    type: 'expense',
    amount: 100,
    currency_code: 'ARS',
    status: 'pending',
    received_at: null,
    cancelled_at: null,
    card_period_id: 'p-visa',
    ...over,
  }) as never

  const meta = [
    { id: 'visa', label: 'Visa', nextClose: '2026-08-28' },
    { id: 'amex', label: 'Amex', nextClose: null },
  ]
  const periodToCard = new Map([
    ['p-visa', 'visa'],
    ['p-amex', 'amex'],
  ])

  it('groups many consumos into one row per card', () => {
    const rows = aggregateCardDebtByCard(
      [tx({ amount: 300 }), tx({ amount: 88 }), tx({ card_period_id: 'p-amex', amount: 291 })],
      periodToCard,
      meta,
    )

    expect(rows.ARS).toEqual([
      { id: 'visa', label: 'Visa', amount: 388, nextClose: '2026-08-28' },
      { id: 'amex', label: 'Amex', amount: 291, nextClose: null },
    ])
  })

  it('nets received reimbursements against the card that got them', () => {
    const rows = aggregateCardDebtByCard(
      [tx({ amount: 500 }), tx({ type: 'reimbursement', amount: 200, received_at: '2026-08-10' })],
      periodToCard,
      meta,
    )

    expect(rows.ARS[0]!.amount).toBe(300)
  })

  it('drops a card that ends up owing nothing', () => {
    const rows = aggregateCardDebtByCard(
      [tx({ amount: 500 }), tx({ type: 'reimbursement', amount: 500, received_at: '2026-08-10' })],
      periodToCard,
      meta,
    )

    expect(rows.ARS).toEqual([])
  })

  it('keeps the currencies apart', () => {
    const rows = aggregateCardDebtByCard(
      [tx({ amount: 1_000 }), tx({ currency_code: 'USD', amount: 60 })],
      periodToCard,
      meta,
    )

    expect(rows.ARS.map((r) => r.amount)).toEqual([1_000])
    expect(rows.USD.map((r) => r.amount)).toEqual([60])
  })

  it('skips a consumo whose statement maps to no known card', () => {
    // A mislabelled amount is worse than a missing row; the currency total does
    // not come from here.
    const rows = aggregateCardDebtByCard(
      [tx({ card_period_id: 'p-unknown', amount: 900 }), tx({ amount: 100 })],
      periodToCard,
      meta,
    )

    expect(rows.ARS).toHaveLength(1)
    expect(rows.ARS[0]!.amount).toBe(100)
  })

  it('breaks ties by id so both platforms rank the same way', () => {
    const rows = aggregateCardDebtByCard(
      [tx({ amount: 100 }), tx({ card_period_id: 'p-amex', amount: 100 })],
      periodToCard,
      meta,
    )

    expect(rows.ARS.map((r) => r.id)).toEqual(['amex', 'visa'])
  })
})

describe('deriveSpendingPace — desborde', () => {
  it('marca overflow cuando el ingreso del mes es casi cero', () => {
    // Caso real: un mes cuyo unico ingreso fueron 39 centavos.
    const pace = deriveSpendingPace(483_740.94, 0.39)

    expect(pace).toEqual({
      status: 'overflow',
      pct: 124_036_138,
      spent: 483_740.94,
      income: 0.39,
    })
  })

  it('NO es indeterminado: entro plata, solo que poca', () => {
    // La diferencia importa: 'indeterminate' dice que no hay denominador.
    expect(deriveSpendingPace(483_740.94, 0.39).status).not.toBe('indeterminate')
  })

  it('un exceso extremo pero legible conserva su numero', () => {
    // Gastar diez veces lo que entro es extraordinario y perfectamente legible.
    const pace = deriveSpendingPace(1_020_283.17, 100_000)

    expect(pace).toMatchObject({ status: 'over', pct: 1_020, fillPct: 100 })
  })

  it('el borde del umbral todavia muestra su numero', () => {
    const pace = deriveSpendingPace(PACE_OVERFLOW_PCT, 100)

    expect(pace).toMatchObject({ status: 'over', pct: PACE_OVERFLOW_PCT })
  })
})
