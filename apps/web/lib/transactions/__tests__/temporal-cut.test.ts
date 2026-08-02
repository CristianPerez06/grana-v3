import { describe, expect, it } from 'vitest'
import {
  cajaCutOrFilter,
  countsUnderTemporalCut,
  earlierISO,
  isCardAccrualRow,
} from '@grana/money-logic'

/**
 * The temporal cut for the month lenses (`cut-month-lenses-at-today`).
 *
 * The rule is one line of business meaning: a cash movement dated after today
 * has not moved money yet, while a card cuota accrues in its MONTH regardless of
 * the day it carries. It lives in `@grana/money-logic` precisely so the five
 * reads that apply it (balance series, donut, drill list, subcategory drill,
 * income donut) cannot each grow their own slightly different version.
 */

describe('countsUnderTemporalCut', () => {
  const today = '2026-08-01'

  it('counts an on-ledger row dated today (inclusive boundary)', () => {
    expect(countsUnderTemporalCut({ date: '2026-08-01', status: null }, today)).toBe(true)
  })

  it('drops an on-ledger row dated tomorrow', () => {
    expect(countsUnderTemporalCut({ date: '2026-08-02', status: null }, today)).toBe(false)
  })

  it('counts an on-ledger row from the past', () => {
    expect(countsUnderTemporalCut({ date: '2026-07-08', status: null }, today)).toBe(true)
  })

  it('counts a card row dated later in the month (devengado, never cut)', () => {
    expect(countsUnderTemporalCut({ date: '2026-08-20', status: 'pending' }, today)).toBe(true)
    expect(countsUnderTemporalCut({ date: '2026-08-20', status: 'paid' }, today)).toBe(true)
  })

  it('treats a missing status as on-ledger (the CAJA default)', () => {
    expect(countsUnderTemporalCut({ date: '2026-08-05' }, today)).toBe(false)
  })
})

describe('isCardAccrualRow', () => {
  it('is true only when a status is present', () => {
    expect(isCardAccrualRow({ status: 'pending' })).toBe(true)
    expect(isCardAccrualRow({ status: 'paid' })).toBe(true)
    expect(isCardAccrualRow({ status: null })).toBe(false)
    expect(isCardAccrualRow({})).toBe(false)
  })
})

describe('earlierISO', () => {
  it('returns the earlier of two dates', () => {
    expect(earlierISO('2026-08-31', '2026-08-01')).toBe('2026-08-01')
    expect(earlierISO('2026-07-31', '2026-08-01')).toBe('2026-07-31')
  })

  it('returns the shared value when both are equal', () => {
    expect(earlierISO('2026-08-01', '2026-08-01')).toBe('2026-08-01')
  })

  it('orders across year boundaries (lexicographic == chronological)', () => {
    expect(earlierISO('2027-01-01', '2026-12-31')).toBe('2026-12-31')
  })
})

describe('cajaCutOrFilter', () => {
  // The exact PostgREST predicate. Pinned because a typo here does not throw —
  // it silently changes WHICH rows a money number is built from.
  it('emits (status IS NOT NULL OR date <= today)', () => {
    expect(cajaCutOrFilter('2026-08-01')).toBe('status.not.is.null,date.lte.2026-08-01')
  })
})
