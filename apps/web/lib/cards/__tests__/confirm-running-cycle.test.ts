import { describe, it, expect } from 'vitest'
import { planRunningCycleConfirmation } from '../utils'

// Paying P(n) confirms the dates of P(n+1) — the cycle the statement in hand
// announces. These tests cover the delta-spec scenarios of the requirement
// "El pago de un resumen confirma las fechas del período en curso y crea el
// siguiente estimado".

// P1 being paid: closed 16/06. P2 estimated: 17/06 → ~14/07.
const paid = { paidPeriodEndDate: '2026-06-16' }
const estimatedNext = {
  start_date: '2026-06-17',
  end_date: '2026-07-14',
  due_date: '2026-07-20',
  has_payment: false,
}

describe('planRunningCycleConfirmation', () => {
  it('happy path: confirms the estimated P2 and creates P3 estimated eagerly', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: estimatedNext,
      nextNext: null,
      confirmedEndDate: '2026-07-16',
      confirmedDueDate: '2026-07-22',
    })
    expect(plan).toEqual({
      action: 'apply',
      createConfirmedNext: false,
      nextNextOp: 'none',
      createEagerEstimated: true,
      reassignShrunkTailToEager: false,
    })
  })

  it('real close earlier than estimated: shrunk tail moves to the eager P3', () => {
    // Estimated close 20/07, statement says 16/07 — a consumo on the 18th
    // must end up in the (new) estimated P3.
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: { ...estimatedNext, end_date: '2026-07-20', due_date: '2026-07-26' },
      nextNext: null,
      confirmedEndDate: '2026-07-16',
      confirmedDueDate: '2026-07-22',
    })
    expect(plan).toEqual({
      action: 'apply',
      createConfirmedNext: false,
      nextNextOp: 'none',
      createEagerEstimated: true,
      reassignShrunkTailToEager: true,
    })
  })

  it('rejects a confirmed close not after the paid period close', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: estimatedNext,
      nextNext: null,
      confirmedEndDate: '2026-06-10',
      confirmedDueDate: '2026-06-20',
    })
    expect(plan).toEqual({ action: 'reject', reason: 'end_not_after_paid_close' })
  })

  it('re-projects a bare estimated P3 the confirmed close would swallow', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: estimatedNext,
      nextNext: {
        start_date: '2026-07-15',
        end_date: '2026-08-12',
        is_estimated: true,
        has_payment: false,
        has_transactions: false,
      },
      confirmedEndDate: '2026-08-15',
      confirmedDueDate: '2026-08-21',
    })
    expect(plan).toEqual({
      action: 'apply',
      createConfirmedNext: false,
      nextNextOp: 'reproject',
      createEagerEstimated: false,
      reassignShrunkTailToEager: false,
    })
  })

  it('keeps the swallow guard when P3 has real data', () => {
    const base = {
      ...paid,
      nextPeriod: estimatedNext,
      confirmedEndDate: '2026-08-15',
      confirmedDueDate: '2026-08-21',
    }
    const nextNext = {
      start_date: '2026-07-15',
      end_date: '2026-08-12',
      is_estimated: true,
      has_payment: false,
      has_transactions: false,
    }
    expect(
      planRunningCycleConfirmation({ ...base, nextNext: { ...nextNext, has_transactions: true } }),
    ).toEqual({ action: 'reject', reason: 'would_swallow_real_period' })
    expect(
      planRunningCycleConfirmation({ ...base, nextNext: { ...nextNext, is_estimated: false } }),
    ).toEqual({ action: 'reject', reason: 'would_swallow_real_period' })
  })

  it('cascades the boundary against an existing P3 (extend and shrink)', () => {
    const nextNext = {
      start_date: '2026-07-15',
      end_date: '2026-08-12',
      is_estimated: true,
      has_payment: false,
      has_transactions: true,
    }
    expect(
      planRunningCycleConfirmation({
        ...paid,
        nextPeriod: estimatedNext,
        nextNext,
        confirmedEndDate: '2026-07-18',
        confirmedDueDate: '2026-07-24',
      }),
    ).toMatchObject({ action: 'apply', nextNextOp: 'shift_extend' })
    expect(
      planRunningCycleConfirmation({
        ...paid,
        nextPeriod: estimatedNext,
        nextNext,
        confirmedEndDate: '2026-07-10',
        confirmedDueDate: '2026-07-17',
      }),
    ).toMatchObject({ action: 'apply', nextNextOp: 'shift_shrink' })
  })

  it('rejects moving the boundary when P3 is already paid', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: estimatedNext,
      nextNext: {
        start_date: '2026-07-15',
        end_date: '2026-08-12',
        is_estimated: false,
        has_payment: true,
        has_transactions: true,
      },
      confirmedEndDate: '2026-07-16',
      confirmedDueDate: '2026-07-22',
    })
    expect(plan).toEqual({ action: 'reject', reason: 'boundary_next_paid' })
  })

  it('rejects changing dates of an already-paid running cycle', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: { ...estimatedNext, has_payment: true },
      nextNext: null,
      confirmedEndDate: '2026-07-16',
      confirmedDueDate: '2026-07-22',
    })
    expect(plan).toEqual({ action: 'reject', reason: 'next_already_paid' })
  })

  it('accepts unchanged dates on a paid running cycle (no-op confirmation)', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: { ...estimatedNext, has_payment: true },
      nextNext: null,
      confirmedEndDate: estimatedNext.end_date,
      confirmedDueDate: estimatedNext.due_date,
    })
    expect(plan).toMatchObject({ action: 'apply', createEagerEstimated: true })
  })

  it('legacy card with no running period row: creates it confirmed plus the eager estimated', () => {
    const plan = planRunningCycleConfirmation({
      ...paid,
      nextPeriod: null,
      nextNext: null,
      confirmedEndDate: '2026-07-16',
      confirmedDueDate: '2026-07-22',
    })
    expect(plan).toEqual({
      action: 'apply',
      createConfirmedNext: true,
      nextNextOp: 'none',
      createEagerEstimated: true,
      reassignShrunkTailToEager: false,
    })
  })
})
