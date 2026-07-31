import { describe, it, expect } from 'vitest'
import {
  groupCardsByBank,
  sortCardsByDue,
  applyFilter,
  countByFilter,
  cardUsePercent,
  cardTone,
  cardHasBalance,
  CARD_PREDICATE_FILTERS,
  NO_BANK_KEY,
} from '../grouping'
import type { CreditCardSummary } from '../types'

// ── Test factories ────────────────────────────────────────────────────────────

type PeriodOver = {
  due_date?: string
  variant?: string
  alert?: 'red' | 'amber' | 'none'
  pendingAmountARS?: number
  pendingAmountUSD?: number
  tx_count?: number
}

type CardOver = {
  id?: string
  name?: string
  bank?: string | null
  brandColor?: string | null
  credit_limit?: number | null
  inUse?: boolean
  /** Pass `null` to model a card with no active cycle. */
  period?: PeriodOver | null
}

const mkCard = (over: CardOver = {}): CreditCardSummary => {
  const {
    id = 'c1',
    name = 'Card',
    bank = 'Galicia',
    brandColor = '#ff7a00',
    credit_limit = 100_000,
    inUse = false,
    period = {},
  } = over

  const activePeriod =
    period === null
      ? null
      : ({
          due_date: period.due_date ?? '2026-07-10',
          variant: period.variant ?? 'actual',
          alert: period.alert ?? 'none',
          pendingAmountARS: period.pendingAmountARS ?? 0,
          pendingAmountUSD: period.pendingAmountUSD ?? 0,
          tx_count: period.tx_count ?? 0,
        } as unknown as CreditCardSummary['activePeriod'])

  return {
    id,
    name,
    type: 'credit',
    is_active: true,
    credit_limit,
    network_id: null,
    other_network_name: null,
    institution_id: bank ? `inst-${bank}` : null,
    institution: bank ? { name: bank, brand_color: brandColor, icon_type: null } : null,
    color_key: null,
    icon_key: null,
    created_at: '2026-01-01',
    currencies: [],
    activeInstallmentsCount: 0,
    inUse,
    activePeriod,
    inProgress: null,
  }
}

// ── cardTone / cardHasBalance / cardUsePercent ──────────────────────────────────

describe('cardTone', () => {
  it('is "due" for vencido / cerrado_esperando_pago / red alert', () => {
    expect(cardTone(mkCard({ period: { variant: 'vencido' } }))).toBe('due')
    expect(cardTone(mkCard({ period: { variant: 'cerrado_esperando_pago' } }))).toBe('due')
    expect(cardTone(mkCard({ period: { alert: 'red' } }))).toBe('due')
  })
  it('is "soon" for amber alert', () => {
    expect(cardTone(mkCard({ period: { alert: 'amber' } }))).toBe('soon')
  })
  it('is "ok" otherwise and when there is no active period', () => {
    expect(cardTone(mkCard({ period: { variant: 'actual' } }))).toBe('ok')
    expect(cardTone(mkCard({ period: null }))).toBe('ok')
  })
})

describe('cardHasBalance', () => {
  it('is true when either currency has a pending balance', () => {
    expect(cardHasBalance(mkCard({ period: { pendingAmountARS: 100 } }))).toBe(true)
    expect(cardHasBalance(mkCard({ period: { pendingAmountUSD: 5 } }))).toBe(true)
    expect(cardHasBalance(mkCard({ period: { pendingAmountARS: 0, pendingAmountUSD: 0 } }))).toBe(false)
  })
})

describe('cardUsePercent', () => {
  it('returns null when no limit is loaded', () => {
    expect(cardUsePercent(mkCard({ credit_limit: null }))).toBeNull()
    expect(cardUsePercent(mkCard({ credit_limit: 0 }))).toBeNull()
  })
  it('computes and clamps the statement usage', () => {
    expect(cardUsePercent(mkCard({ credit_limit: 100_000, period: { pendingAmountARS: 34_000 } }))).toBe(34)
    expect(cardUsePercent(mkCard({ credit_limit: 100_000, period: { pendingAmountARS: 250_000 } }))).toBe(100)
  })
})

// ── sortCardsByDue ──────────────────────────────────────────────────────────────

describe('sortCardsByDue', () => {
  it('orders by due date ascending and pushes cards without a cycle last', () => {
    const a = mkCard({ id: 'a', period: { due_date: '2026-07-13' } })
    const b = mkCard({ id: 'b', period: { due_date: '2026-06-18' } })
    const c = mkCard({ id: 'c', period: null })
    expect(sortCardsByDue([a, b, c]).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})

// ── applyFilter ─────────────────────────────────────────────────────────────────

describe('applyFilter', () => {
  const inUse = mkCard({ id: 'u', inUse: true })
  const idle = mkCard({ id: 'i', inUse: false })
  const dueSoon = mkCard({ id: 'd', period: { alert: 'amber' } })
  const withBal = mkCard({ id: 'b', period: { pendingAmountARS: 500 } })
  const cards = [inUse, idle, dueSoon, withBal]

  it('"in-use" keeps cards flagged inUse', () => {
    expect(applyFilter(cards, 'in-use').map((c) => c.id)).toEqual(['u'])
  })
  it('"due-soon" keeps non-ok cards', () => {
    expect(applyFilter(cards, 'due-soon').map((c) => c.id)).toEqual(['d'])
  })
  it('"with-balance" keeps cards with a pending balance', () => {
    expect(applyFilter(cards, 'with-balance').map((c) => c.id)).toEqual(['b'])
  })
  it('"by-bank" and "all" keep everything', () => {
    expect(applyFilter(cards, 'by-bank')).toHaveLength(4)
    expect(applyFilter(cards, 'all')).toHaveLength(4)
  })
})

// ── countByFilter ───────────────────────────────────────────────────────────────

describe('countByFilter', () => {
  it('returns 0 for every predicate on an empty list', () => {
    expect(countByFilter([])).toEqual({ all: 0, 'in-use': 0, 'due-soon': 0, 'with-balance': 0 })
  })

  it('counts a card under every predicate it satisfies', () => {
    // One card that is in use, about to fall due, and carries a balance.
    const overlapping = mkCard({
      id: 'x',
      inUse: true,
      period: { alert: 'amber', pendingAmountARS: 4_200 },
    })
    expect(countByFilter([overlapping])).toEqual({
      all: 1,
      'in-use': 1,
      'due-soon': 1,
      'with-balance': 1,
    })
  })

  it('never diverges from what applyFilter would show', () => {
    const cards = [
      mkCard({ id: 'u', inUse: true }),
      mkCard({ id: 'i' }),
      mkCard({ id: 'd', period: { alert: 'amber' } }),
      mkCard({ id: 'b', period: { pendingAmountARS: 500 } }),
      mkCard({ id: 'n', period: null }),
    ]
    const counts = countByFilter(cards)
    for (const filter of CARD_PREDICATE_FILTERS) {
      expect(counts[filter]).toBe(applyFilter(cards, filter).length)
    }
  })
})

// ── groupCardsByBank ────────────────────────────────────────────────────────────

describe('groupCardsByBank', () => {
  it('groups by bank, ordering due-first and "Sin banco" last', () => {
    const galiciaOk = mkCard({ id: 'g', bank: 'Galicia', period: { due_date: '2026-07-06' } })
    const santanderDue = mkCard({
      id: 's',
      bank: 'Santander',
      period: { variant: 'vencido', alert: 'red', due_date: '2026-06-09', pendingAmountARS: 92_150 },
    })
    const noBank = mkCard({ id: 'n', bank: null, period: { due_date: '2026-06-05' } })

    const groups = groupCardsByBank([galiciaOk, santanderDue, noBank])
    expect(groups.map((g) => g.key)).toEqual(['Santander', 'Galicia', NO_BANK_KEY])
    expect(groups[2].name).toBeNull()
  })

  it('auto-collapses only banks fully ok and at $0', () => {
    const settled = mkCard({ id: 'a', bank: 'BBVA', period: { variant: 'actual', pendingAmountARS: 0 } })
    const withDebt = mkCard({
      id: 'b',
      bank: 'ICBC',
      period: { variant: 'cerrado_esperando_pago', alert: 'amber', pendingAmountARS: 23_400 },
    })
    const groups = groupCardsByBank([settled, withDebt])
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]))
    expect(byKey.BBVA.defaultCollapsed).toBe(true)
    expect(byKey.ICBC.defaultCollapsed).toBe(false)
  })

  it('aggregates inUseCount, toPay per currency, worst tone and next due', () => {
    const due = mkCard({
      id: 'd',
      bank: 'X',
      inUse: true,
      period: { variant: 'vencido', alert: 'red', due_date: '2026-06-09', pendingAmountARS: 1000, pendingAmountUSD: 10 },
    })
    const ok = mkCard({
      id: 'o',
      bank: 'X',
      inUse: false,
      period: { variant: 'actual', due_date: '2026-07-20', pendingAmountARS: 0 },
    })
    const [g] = groupCardsByBank([ok, due])
    expect(g.count).toBe(2)
    expect(g.inUseCount).toBe(1)
    expect(g.toPayARS).toBe(1000)
    expect(g.toPayUSD).toBe(10)
    expect(g.tone).toBe('due')
    expect(g.nextDueDate).toBe('2026-06-09')
    // ok+$0 card alone would collapse, but the due card keeps the group open.
    expect(g.defaultCollapsed).toBe(false)
  })
})
