import { describe, expect, it } from 'vitest'
import {
  MAX_ROLL_FORWARD_PERIODS,
  derivePeriodVariant,
  planPeriodEndEdit,
  planPeriodRollForward,
  type PeriodEndEditLater,
} from '../src/cards'

const today = new Date(2026, 9, 6) // 2026-10-06

describe('derivePeriodVariant — sin_consumos', () => {
  const closed = { start_date: '2026-08-25', end_date: '2026-09-24', due_date: '2026-10-10' }
  const overdue = { start_date: '2026-05-26', end_date: '2026-06-25', due_date: '2026-07-08' }

  it('a closed period with no transactions closes by itself', () => {
    expect(derivePeriodVariant(closed, today, false, 0)).toBe('sin_consumos')
  })
  it('an overdue period with no transactions closes by itself', () => {
    expect(derivePeriodVariant(overdue, today, false, 0)).toBe('sin_consumos')
  })
  it('closed and overdue periods with transactions keep their variants', () => {
    expect(derivePeriodVariant(closed, today, false, 2)).toBe('cerrado_esperando_pago')
    expect(derivePeriodVariant(overdue, today, false, 1)).toBe('vencido')
  })
  it('open and paid periods are unchanged', () => {
    const open = { start_date: '2026-09-25', end_date: '2026-10-24', due_date: '2026-11-05' }
    expect(derivePeriodVariant(open, today, false, 0)).toBe('tarjeta_nueva')
    expect(derivePeriodVariant(open, today, false, 3)).toBe('actual')
    expect(derivePeriodVariant(overdue, today, true, 0)).toBe('pagado')
  })
})

describe('planPeriodRollForward', () => {
  const p1 = { start_date: '2026-05-26', end_date: '2026-06-25', due_date: '2026-07-08' }
  const p2 = { start_date: '2026-06-26', end_date: '2026-07-25', due_date: '2026-08-07' }

  it('plans nothing when the last period already reaches the date', () => {
    expect(planPeriodRollForward([p1, p2], '2026-07-20', today)).toEqual([])
    expect(planPeriodRollForward([p1, p2], '2026-07-25', today)).toEqual([])
  })

  it('plans nothing without a period to anchor on', () => {
    expect(planPeriodRollForward([], '2026-10-06', today)).toEqual([])
  })

  it('plans every contiguous period until one covers the date', () => {
    const plan = planPeriodRollForward([p1, p2], '2026-10-06', today)
    expect(plan.length).toBe(3)
    expect(plan[0].start_date).toBe('2026-07-26')
    for (let i = 1; i < plan.length; i++) {
      const prevEnd = new Date(plan[i - 1].end_date)
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1)
      expect(plan[i].start_date).toBe(prevEnd.toISOString().slice(0, 10))
    }
    const last = plan[plan.length - 1]
    expect(last.start_date <= '2026-10-06' && '2026-10-06' <= last.end_date).toBe(true)
    for (const p of plan) expect(p.due_date > p.end_date).toBe(true)
  })

  it('respects the safety cap', () => {
    const plan = planPeriodRollForward([p1, p2], '2099-01-01', today)
    expect(plan.length).toBe(MAX_ROLL_FORWARD_PERIODS)
  })
})

describe('planPeriodEndEdit', () => {
  const later = (over: Partial<PeriodEndEditLater> & { id: string }): PeriodEndEditLater => ({
    start_date: '2026-10-24',
    end_date: '2026-11-22',
    is_estimated: true,
    has_payment: false,
    has_transactions: false,
    ...over,
  })

  it('does nothing when the boundary does not move', () => {
    expect(
      planPeriodEndEdit({ oldEndDate: '2026-10-23', newEndDate: '2026-10-23', later: [later({ id: 'p2' })] }),
    ).toEqual({ action: 'apply', deleteIds: [], shift: null, createEstimatedAfter: false })
  })

  it('cascades the boundary when nothing is swallowed', () => {
    expect(
      planPeriodEndEdit({ oldEndDate: '2026-10-23', newEndDate: '2026-10-25', later: [later({ id: 'p2' })] }),
    ).toEqual({
      action: 'apply',
      deleteIds: [],
      shift: { id: 'p2', newStartDate: '2026-10-26', direction: 'extend' },
      createEstimatedAfter: false,
    })
    expect(
      planPeriodEndEdit({ oldEndDate: '2026-10-23', newEndDate: '2026-10-20', later: [later({ id: 'p2' })] }),
    ).toMatchObject({ shift: { id: 'p2', newStartDate: '2026-10-21', direction: 'shrink' } })
  })

  it('absorbs an empty estimated next and asks for a new estimated one', () => {
    expect(
      planPeriodEndEdit({ oldEndDate: '2026-10-23', newEndDate: '2026-11-25', later: [later({ id: 'p2' })] }),
    ).toEqual({ action: 'apply', deleteIds: ['p2'], shift: null, createEstimatedAfter: true })
  })

  it('absorbs and shifts the first period left after the new close', () => {
    const plan = planPeriodEndEdit({
      oldEndDate: '2026-10-23',
      newEndDate: '2026-11-25',
      later: [
        later({ id: 'p3', start_date: '2026-11-23', end_date: '2026-12-22' }),
        later({ id: 'p2' }),
      ],
    })
    expect(plan).toEqual({
      action: 'apply',
      deleteIds: ['p2'],
      shift: { id: 'p3', newStartDate: '2026-11-26', direction: 'extend' },
      createEstimatedAfter: false,
    })
  })

  it('keeps the guard when a swallowed period has real data', () => {
    for (const over of [{ has_transactions: true }, { is_estimated: false }]) {
      expect(
        planPeriodEndEdit({
          oldEndDate: '2026-10-23',
          newEndDate: '2026-11-25',
          later: [later({ id: 'p2', ...over })],
        }),
      ).toEqual({ action: 'reject', reason: 'would_swallow_next' })
    }
  })

  it('rejects when the next period is paid', () => {
    expect(
      planPeriodEndEdit({
        oldEndDate: '2026-10-23',
        newEndDate: '2026-10-25',
        later: [later({ id: 'p2', has_payment: true })],
      }),
    ).toEqual({ action: 'reject', reason: 'boundary_next_paid' })
  })
})
