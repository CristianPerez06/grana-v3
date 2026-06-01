import { describe, it, expect } from 'vitest'
import { classifyPeriodsLifecycle } from '../utils'

// Pure classification of the three coexisting statements (a pagar / en curso /
// próximo). Uses new Date(year, month-1, day) — local time — to keep ISO
// boundaries stable across timezones (same convention as utils.test.ts).

type P = {
  id: string
  start_date: string
  end_date: string
  due_date: string
  has_payment: boolean
  tx_count: number
}

const mk = (id: string, start: string, end: string, due: string, over: Partial<P> = {}): P => ({
  id,
  start_date: start,
  end_date: end,
  due_date: due,
  has_payment: false,
  tx_count: 0,
  ...over,
})

describe('classifyPeriodsLifecycle', () => {
  it('returns all null for an empty list', () => {
    expect(classifyPeriodsLifecycle([], new Date(2026, 5, 1))).toEqual({
      apagar: null,
      curso: null,
      prox: null,
    })
  })

  it('classifies a closed-with-debt as "a pagar", the open as "en curso", the next as "próximo"', () => {
    const today = new Date(2026, 5, 1) // 2026-06-01
    // P1 closed (ended 28/05, due 10/06) with charges → a pagar
    const p1 = mk('p1', '2026-05-01', '2026-05-28', '2026-06-10', { tx_count: 3 })
    // P2 open (contains today) → en curso
    const p2 = mk('p2', '2026-05-29', '2026-06-28', '2026-07-10', { tx_count: 1 })
    // P3 future → próximo
    const p3 = mk('p3', '2026-06-29', '2026-07-28', '2026-08-10')

    const result = classifyPeriodsLifecycle([p3, p1, p2], today)
    expect(result.apagar?.id).toBe('p1')
    expect(result.curso?.id).toBe('p2')
    expect(result.prox?.id).toBe('p3')
  })

  it('returns apagar=null when everything closed is already paid', () => {
    const today = new Date(2026, 5, 1)
    const p1 = mk('p1', '2026-05-01', '2026-05-28', '2026-06-10', { tx_count: 3, has_payment: true })
    const p2 = mk('p2', '2026-05-29', '2026-06-28', '2026-07-10', { tx_count: 1 })
    const p3 = mk('p3', '2026-06-29', '2026-07-28', '2026-08-10')

    const result = classifyPeriodsLifecycle([p1, p2, p3], today)
    expect(result.apagar).toBeNull()
    expect(result.curso?.id).toBe('p2')
    expect(result.prox?.id).toBe('p3')
  })

  it('prefers an overdue-with-debt over a merely closed one for "a pagar"', () => {
    const today = new Date(2026, 5, 20) // 2026-06-20
    // P1 overdue (due 10/06 < today) with charges → a pagar (most urgent)
    const p1 = mk('p1', '2026-05-01', '2026-05-28', '2026-06-10', { tx_count: 2 })
    // P2 closed (ended 18/06, due 30/06) with charges
    const p2 = mk('p2', '2026-05-29', '2026-06-18', '2026-06-30', { tx_count: 4 })

    const result = classifyPeriodsLifecycle([p1, p2], today)
    expect(result.apagar?.id).toBe('p1')
  })

  it('ignores closed periods without transactions for "a pagar"', () => {
    const today = new Date(2026, 5, 1)
    // Closed but empty (tx_count 0) → not "a pagar"
    const p1 = mk('p1', '2026-05-01', '2026-05-28', '2026-06-10', { tx_count: 0 })
    const p2 = mk('p2', '2026-05-29', '2026-06-28', '2026-07-10', { tx_count: 1 })

    const result = classifyPeriodsLifecycle([p1, p2], today)
    expect(result.apagar).toBeNull()
    expect(result.curso?.id).toBe('p2')
  })

  it('returns prox=null when no period exists after the current one', () => {
    const today = new Date(2026, 5, 1)
    const p1 = mk('p1', '2026-05-29', '2026-06-28', '2026-07-10', { tx_count: 1 })

    const result = classifyPeriodsLifecycle([p1], today)
    expect(result.curso?.id).toBe('p1')
    expect(result.prox).toBeNull()
  })

  it('keeps the three buckets mutually exclusive', () => {
    const today = new Date(2026, 5, 1)
    const p1 = mk('p1', '2026-05-01', '2026-05-28', '2026-06-10', { tx_count: 3 })
    const p2 = mk('p2', '2026-05-29', '2026-06-28', '2026-07-10', { tx_count: 1 })
    const p3 = mk('p3', '2026-06-29', '2026-07-28', '2026-08-10')

    const { apagar, curso, prox } = classifyPeriodsLifecycle([p1, p2, p3], today)
    const ids = [apagar?.id, curso?.id, prox?.id].filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
