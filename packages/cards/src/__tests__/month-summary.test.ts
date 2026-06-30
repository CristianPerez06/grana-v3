import { describe, it, expect } from 'vitest'
import { summarizeCardsMonth, NEXT_CLOSES_CAP, type MonthSummaryCard } from '../month-summary'

const TODAY = '2026-06-21'

type ActiveOver = {
  end_date?: string
  due_date?: string
  tx_count?: number
  has_payment?: boolean
  pendingAmountARS?: number
  pendingAmountUSD?: number
}

const active = (over: ActiveOver): NonNullable<MonthSummaryCard['activePeriod']> => ({
  end_date: over.end_date ?? '2026-06-30',
  due_date: over.due_date ?? '2026-07-10',
  tx_count: over.tx_count ?? 1,
  has_payment: over.has_payment ?? false,
  pendingAmountARS: over.pendingAmountARS ?? 0,
  pendingAmountUSD: over.pendingAmountUSD ?? 0,
  alert: 'none',
})

const card = (over: Partial<MonthSummaryCard>): MonthSummaryCard => ({
  id: over.id ?? 'c1',
  name: over.name ?? 'Visa',
  currencies: over.currencies ?? [{ currency_code: 'ARS', is_active: true }],
  activePeriod: over.activePeriod ?? null,
  inProgress: over.inProgress ?? null,
})

describe('summarizeCardsMonth — A pagar', () => {
  it('sums only closed-unpaid statements with charges', () => {
    const r = summarizeCardsMonth(
      [
        // closed + unpaid (end_date in the past) → a pagar
        card({ activePeriod: active({ end_date: '2026-06-10', pendingAmountARS: 120_000, tx_count: 2 }) }),
      ],
      TODAY,
    )
    expect(r.toPayARS).toBe(120_000)
    expect(r.hasToPay).toBe(true)
    expect(r.inProgressARS).toBe(0)
  })

  it('does not count an open statement as a pagar', () => {
    const r = summarizeCardsMonth(
      [card({ activePeriod: active({ end_date: '2026-06-30', pendingAmountARS: 50_000 }) })],
      TODAY,
    )
    expect(r.toPayARS).toBe(0)
    expect(r.hasToPay).toBe(false)
  })
})

describe('summarizeCardsMonth — En curso', () => {
  it('sums open statements with balance', () => {
    const r = summarizeCardsMonth(
      [
        card({ id: 'a', inProgress: { endDate: '2026-06-30', amountARS: 80_000, amountUSD: 0 } }),
        card({ id: 'b', inProgress: { endDate: '2026-07-02', amountARS: 50_000, amountUSD: 0 } }),
      ],
      TODAY,
    )
    expect(r.inProgressARS).toBe(130_000)
  })

  it('the open statement of a card that ALSO has an "a pagar" counts in En curso (two live statements, no double count)', () => {
    const r = summarizeCardsMonth(
      [
        card({
          // closed-unpaid (a pagar) + its next open statement (en curso)
          activePeriod: active({ end_date: '2026-06-10', pendingAmountARS: 100_000, tx_count: 3 }),
          inProgress: { endDate: '2026-07-10', amountARS: 30_000, amountUSD: 0 },
        }),
      ],
      TODAY,
    )
    expect(r.toPayARS).toBe(100_000) // closed amount only
    expect(r.inProgressARS).toBe(30_000) // open amount only — no overlap
  })
})

describe('summarizeCardsMonth — Bimoneda', () => {
  it('keeps ARS and USD separate, never summed', () => {
    const r = summarizeCardsMonth(
      [
        card({
          currencies: [
            { currency_code: 'ARS', is_active: true },
            { currency_code: 'USD', is_active: true },
          ],
          inProgress: { endDate: '2026-06-30', amountARS: 90_000, amountUSD: 200 },
        }),
      ],
      TODAY,
    )
    expect(r.inProgressARS).toBe(90_000)
    expect(r.inProgressUSD).toBe(200)
    expect(r.hasUSD).toBe(true)
  })
})

describe('summarizeCardsMonth — Próximos cierres', () => {
  it('one row per card with an open statement, sorted by close date, no amount', () => {
    const r = summarizeCardsMonth(
      [
        card({ id: 'a', name: 'A', inProgress: { endDate: '2026-07-05', amountARS: 10, amountUSD: 0 } }),
        card({ id: 'b', name: 'B', inProgress: { endDate: '2026-06-25', amountARS: 20, amountUSD: 0 } }),
        card({ id: 'c', name: 'C', inProgress: { endDate: '2026-06-28', amountARS: 30, amountUSD: 0 } }),
        card({ id: 'd', name: 'D', inProgress: { endDate: '2026-08-01', amountARS: 40, amountUSD: 0 } }),
      ],
      TODAY,
    )
    expect(r.nextCloses.map((c) => c.cardName)).toEqual(['B', 'C', 'A', 'D']) // by endDate asc
    expect(r.nextCloses[0]).toEqual({ endDate: '2026-06-25', cardName: 'B' }) // no amount
  })

  it(`caps the list at NEXT_CLOSES_CAP (${NEXT_CLOSES_CAP})`, () => {
    const many = Array.from({ length: NEXT_CLOSES_CAP + 2 }, (_, i) =>
      card({
        id: `c${i}`,
        name: `Card ${i}`,
        inProgress: { endDate: `2026-07-${String(i + 1).padStart(2, '0')}`, amountARS: 1, amountUSD: 0 },
      }),
    )
    expect(summarizeCardsMonth(many, TODAY).nextCloses).toHaveLength(NEXT_CLOSES_CAP)
  })

  it('includes an open statement even with $0 balance (date only); it adds $0 to En curso', () => {
    const r = summarizeCardsMonth(
      [card({ inProgress: { endDate: '2026-06-30', amountARS: 0, amountUSD: 0 } })],
      TODAY,
    )
    expect(r.nextCloses).toHaveLength(1)
    expect(r.inProgressARS).toBe(0)
  })
})

describe('summarizeCardsMonth — empty', () => {
  it('no cards → zeros and empty lists (hero shows $0, not a message)', () => {
    const r = summarizeCardsMonth([], TODAY)
    expect(r).toMatchObject({
      toPayARS: 0,
      toPayUSD: 0,
      inProgressARS: 0,
      inProgressUSD: 0,
      hasToPay: false,
      nextCloses: [],
    })
  })
})
