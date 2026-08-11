import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import {
  getOrCreatePeriodForDate,
  CardConsumoInPaidPeriodError,
  CardConsumoUnassignableError,
  CardPurchasePredatesHistoryError,
} from '../src/internal/card-periods'

/**
 * A card transaction whose date falls inside an already-PAID statement must be
 * rejected, not silently imputed to a fabricated future frontier period. Reproduces
 * the real defect: a consumo dated 2026-06-25 (the cierre day of a paid statement)
 * landed in an estimated 2026-10-24 → 2026-11-23 period. Covers the branch split in
 * getOrCreatePeriodForDate: unpaid cover → use; paid cover → reject; gap → reject;
 * beyond frontier → roll forward; predates → reject.
 */

type PeriodRow = Record<string, unknown>

function period(
  id: string,
  start_date: string,
  end_date: string,
  due_date: string,
): PeriodRow {
  return { id, account_id: 'acc-1', start_date, end_date, due_date, is_estimated: false }
}

/** Mock client for getCardPeriodsWithStatus + optional rolling insert. */
function makeClient(
  periods: PeriodRow[],
  opts: { paidPeriodIds?: string[] } = {},
): { client: GranaSupabaseClient; insertedPeriods: PeriodRow[] } {
  const payments = (opts.paidPeriodIds ?? []).map((period_id) => ({ period_id }))
  const insertedPeriods: PeriodRow[] = []

  const client = {
    from(table: string) {
      if (table === 'card_periods') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: periods, error: null }),
            }),
          }),
          insert: (row: PeriodRow) => ({
            select: () => ({
              single: async () => {
                insertedPeriods.push(row)
                return { data: { id: 'rolled-forward-id' }, error: null }
              },
            }),
          }),
        }
      }
      if (table === 'period_payments') {
        return { select: () => ({ in: async () => ({ data: payments, error: null }) }) }
      }
      if (table === 'transactions') {
        return {
          select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as GranaSupabaseClient

  return { client, insertedPeriods }
}

const today = new Date('2026-08-05T00:00:00Z')

// Statement layout mirroring the real Visa ICBC card (closes on/near the 25th).
const P1 = period('p1', '2026-05-26', '2026-06-25', '2026-07-07') // covers 2026-06-25
const P2 = period('p2', '2026-06-26', '2026-07-23', '2026-08-04')
const P3 = period('p3', '2026-07-24', '2026-08-24', '2026-09-05')
const P4 = period('p4', '2026-08-25', '2026-09-23', '2026-10-05')
const P5 = period('p5', '2026-09-24', '2026-10-23', '2026-11-04') // frontier ends 2026-10-23

describe('getOrCreatePeriodForDate — paid-period guard and roll-forward discipline', () => {
  it('uses the unpaid period covering the date (cierre day included)', async () => {
    const { client, insertedPeriods } = makeClient([P1, P2])
    // 2026-06-25 is P1.end_date — inclusive, and P1 is unpaid.
    const id = await getOrCreatePeriodForDate(client, 'acc-1', '2026-06-25', today)
    expect(id).toBe('p1')
    expect(insertedPeriods).toHaveLength(0)
  })

  it('rejects a date that falls inside a PAID statement — no frontier fabricated', async () => {
    // The real case: P1 paid, frontier out at 2026-10-23. 2026-06-25 must reject,
    // NOT create 2026-10-24 → …
    const { client, insertedPeriods } = makeClient([P1, P2, P3, P4, P5], {
      paidPeriodIds: ['p1'],
    })
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-06-25', today),
    ).rejects.toBeInstanceOf(CardConsumoInPaidPeriodError)
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-06-25', today),
    ).rejects.toMatchObject({ periodStart: '2026-05-26', periodEnd: '2026-06-25' })
    expect(insertedPeriods).toHaveLength(0)
  })

  it('rolls forward only when the date is strictly after the last known period', async () => {
    const { client, insertedPeriods } = makeClient([P1])
    const id = await getOrCreatePeriodForDate(client, 'acc-1', '2026-08-01', today)
    expect(id).toBe('rolled-forward-id')
    expect(insertedPeriods).toHaveLength(1)
    expect(insertedPeriods[0]).toMatchObject({ start_date: '2026-06-26', is_estimated: true })
  })

  it('rejects a date that falls in a gap between periods — never fabricates a frontier', async () => {
    // Non-contiguous: gap between 2026-06-25 and 2026-08-24. 2026-07-10 is uncovered,
    // not paid-covered, not before oldest, not after the last end.
    const gapPeriods = [P1, period('p3b', '2026-08-24', '2026-09-23', '2026-10-05')]
    const { client, insertedPeriods } = makeClient(gapPeriods)
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-07-10', today),
    ).rejects.toBeInstanceOf(CardConsumoUnassignableError)
    expect(insertedPeriods).toHaveLength(0)
  })

  it('still rejects a date before the oldest known period', async () => {
    const { client } = makeClient([P1, P2])
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-04-10', today),
    ).rejects.toBeInstanceOf(CardPurchasePredatesHistoryError)
  })
})
