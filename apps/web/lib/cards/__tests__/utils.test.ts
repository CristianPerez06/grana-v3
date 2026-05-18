import { describe, it, expect } from 'vitest'
import { derivePeriodStatus, derivePeriodVariant } from '../utils'

// ── 12.20: derivePeriodStatus — boundary tests ────────────────────────────────
// Use new Date(year, month-1, day) — local time — to avoid UTC-to-local
// offset causing date-boundary tests to read the wrong ISO string.

describe('derivePeriodStatus', () => {
  const period = {
    id: 'p1',
    account_id: 'a1',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    due_date: '2026-06-15',
    is_estimated: false,
    created_at: '2026-04-01T00:00:00Z',
  }

  it('returns "paid" when has_payment=true regardless of dates', () => {
    expect(derivePeriodStatus(period, new Date(2026, 3, 1), true)).toBe('paid')
    expect(derivePeriodStatus(period, new Date(2027, 0, 1), true)).toBe('paid')
  })

  it('returns "open" when today <= end_date', () => {
    expect(derivePeriodStatus(period, new Date(2026, 4, 1), false)).toBe('open')
    expect(derivePeriodStatus(period, new Date(2026, 4, 15), false)).toBe('open')
    expect(derivePeriodStatus(period, new Date(2026, 4, 31), false)).toBe('open')
  })

  it('returns "closed" when end_date < today <= due_date', () => {
    expect(derivePeriodStatus(period, new Date(2026, 5, 1), false)).toBe('closed')
    expect(derivePeriodStatus(period, new Date(2026, 5, 14), false)).toBe('closed')
    expect(derivePeriodStatus(period, new Date(2026, 5, 15), false)).toBe('closed')
  })

  it('returns "overdue" when today > due_date', () => {
    expect(derivePeriodStatus(period, new Date(2026, 5, 16), false)).toBe('overdue')
    expect(derivePeriodStatus(period, new Date(2026, 11, 31), false)).toBe('overdue')
  })
})

// ── derivePeriodVariant ───────────────────────────────────────────────────────

describe('derivePeriodVariant', () => {
  const period = {
    id: 'p1',
    account_id: 'a1',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    due_date: '2026-06-15',
    is_estimated: false,
    created_at: '2026-04-01T00:00:00Z',
  }

  const futurePeriod = {
    ...period,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
    due_date: '2026-08-15',
  }

  it('returns "pagado" when paid', () => {
    expect(derivePeriodVariant(period, new Date(2026, 5, 1), true, 5)).toBe('pagado')
  })

  it('returns "vencido" when overdue and unpaid', () => {
    expect(derivePeriodVariant(period, new Date(2026, 5, 20), false, 3)).toBe('vencido')
  })

  it('returns "cerrado_esperando_pago" when closed and unpaid', () => {
    expect(derivePeriodVariant(period, new Date(2026, 5, 10), false, 3)).toBe('cerrado_esperando_pago')
  })

  it('returns "futuro" when open and start > today', () => {
    expect(derivePeriodVariant(futurePeriod, new Date(2026, 5, 1), false, 0)).toBe('futuro')
  })

  it('returns "tarjeta_nueva" when open and tx_count=0', () => {
    expect(derivePeriodVariant(period, new Date(2026, 4, 15), false, 0)).toBe('tarjeta_nueva')
  })

  it('returns "actual" when open and has transactions', () => {
    expect(derivePeriodVariant(period, new Date(2026, 4, 15), false, 3)).toBe('actual')
  })
})
