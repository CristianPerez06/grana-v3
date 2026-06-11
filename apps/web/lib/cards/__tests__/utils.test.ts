import { describe, it, expect } from 'vitest'
import {
  assignTransactionToPeriod,
  computeStatementPaymentTotal,
  derivePeriodStatus,
  derivePeriodVariant,
  subtractMoneyValues,
  suggestNextPeriodDates,
  sumMoneyValues,
} from '../utils'

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

describe('money helpers', () => {
  it('sums card totals with decimal math', () => {
    expect(sumMoneyValues(['0.10', '0.20', '-0.30'])).toBe(0)
  })

  it('subtracts available credit with decimal math', () => {
    expect(subtractMoneyValues('1000.30', '0.10')).toBe(1000.2)
  })
})

// ── assignTransactionToPeriod — estimated periods receive consumos ────────────

describe('assignTransactionToPeriod', () => {
  it('assigns a post-close purchase to the estimated period without asking dates', () => {
    const periods = [
      {
        id: 'p1',
        start_date: '2026-05-17',
        end_date: '2026-06-16',
        due_date: '2026-06-22',
        is_estimated: false,
        has_payment: false,
        tx_count: 3,
      },
      {
        id: 'p2',
        start_date: '2026-06-17',
        end_date: '2026-07-16',
        due_date: '2026-07-22',
        is_estimated: true,
        has_payment: false,
        tx_count: 0,
      },
    ]
    expect(assignTransactionToPeriod(periods, '2026-06-18')).toBe(periods[1])
  })
})

// ── suggestNextPeriodDates — projection anchors ───────────────────────────────

describe('suggestNextPeriodDates', () => {
  it('falls back to today+30/+45 with no history', () => {
    const result = suggestNextPeriodDates([], new Date(2026, 5, 1))
    expect(result).toEqual({
      suggestedEndDate: '2026-07-01',
      suggestedDueDate: '2026-07-16',
    })
  })

  it('anchors on the single known period, not on today (alta case)', () => {
    // Card created June 1 with the current statement closing June 25: the
    // estimated P2 must be contiguous (close ≈ July 25), regardless of today.
    const result = suggestNextPeriodDates(
      [{ end_date: '2026-06-25', due_date: '2026-07-02' }],
      new Date(2026, 5, 1),
    )
    expect(result.suggestedEndDate).toBe('2026-07-25')
    // close→due gap preserved from the known period (7 days)
    expect(result.suggestedDueDate).toBe('2026-08-01')
  })

  it('averages cycle and gap from prior periods', () => {
    const result = suggestNextPeriodDates(
      [
        { end_date: '2026-04-15', due_date: '2026-04-30' },
        { end_date: '2026-05-15', due_date: '2026-05-30' },
      ],
      new Date(2026, 4, 20),
    )
    expect(result.suggestedEndDate).toBe('2026-06-14')
    expect(result.suggestedDueDate).toBe('2026-06-29')
  })
})

describe('computeStatementPaymentTotal', () => {
  it('returns the ARS pending untouched when there is no USD debt', () => {
    expect(computeStatementPaymentTotal(10000.5, 0, null)).toBe(10000.5)
    expect(computeStatementPaymentTotal(10000.5, 0, 1200)).toBe(10000.5)
  })

  it('returns null while USD debt has no usable rate', () => {
    expect(computeStatementPaymentTotal(10000.5, 50, null)).toBeNull()
    expect(computeStatementPaymentTotal(10000.5, 50, 0)).toBeNull()
    expect(computeStatementPaymentTotal(10000.5, 50, -1)).toBeNull()
  })

  it('converts USD at the payment-day rate and keeps the centavo exact', () => {
    // 50 × 1230.50 = 61525 → 10000.50 + 61525 = 71525.50
    expect(computeStatementPaymentTotal(10000.5, 50, 1230.5)).toBe(71525.5)
    // Rounding to centavos: 33.33 × 1234.567 = 41148.118... → 41148.12
    expect(computeStatementPaymentTotal(0, 33.33, 1234.567)).toBe(41148.12)
    // Float-hostile pair: 0.1 + (0.2 × 1) = 0.3 exactly (Money, not IEEE754)
    expect(computeStatementPaymentTotal(0.1, 0.2, 1)).toBe(0.3)
  })
})
