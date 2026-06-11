import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import {
  getOrCreatePeriodForDate,
  CardPurchasePredatesHistoryError,
} from '../src/internal/card-periods'
import { registerCardPurchase } from '../src/register-card-purchase'

/**
 * A purchase dated before the card's oldest period must be rejected, not
 * silently assigned to a future rolled-forward period. Covers the shared guard
 * in getOrCreatePeriodForDate and its surfacing in registerCardPurchase.
 */

const OLDEST = {
  id: 'p1',
  account_id: 'acc-1',
  start_date: '2026-05-17',
  end_date: '2026-06-16',
  due_date: '2026-06-22',
  is_estimated: false,
  created_at: '2026-05-17T00:00:00Z',
}

/** Mock client serving getCardPeriodsWithStatus (+ optional account row / insert). */
function makeClient(
  periods: Array<Record<string, unknown>>,
  opts: { account?: { type: string; is_active: boolean } } = {},
): GranaSupabaseClient {
  return {
    from(table: string) {
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: opts.account ?? { type: 'credit', is_active: true },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'card_periods') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: periods, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'rolled-forward-id' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'period_payments') {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) }
      }
      if (table === 'transactions') {
        return {
          select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

const today = new Date('2026-06-01T00:00:00Z')

describe('getOrCreatePeriodForDate — predates-history guard', () => {
  it('throws CardPurchasePredatesHistoryError for a date before the oldest period', async () => {
    const client = makeClient([OLDEST])
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-04-10', today),
    ).rejects.toBeInstanceOf(CardPurchasePredatesHistoryError)
    await expect(
      getOrCreatePeriodForDate(client, 'acc-1', '2026-04-10', today),
    ).rejects.toMatchObject({ oldestStartDate: '2026-05-17' })
  })

  it('returns the existing period when the date falls inside it', async () => {
    const client = makeClient([OLDEST])
    const id = await getOrCreatePeriodForDate(client, 'acc-1', '2026-05-30', today)
    expect(id).toBe('p1')
  })

  it('rolls forward (creates a period) for a date after the newest period', async () => {
    const client = makeClient([OLDEST])
    const id = await getOrCreatePeriodForDate(client, 'acc-1', '2026-08-01', today)
    expect(id).toBe('rolled-forward-id')
  })
})

describe('registerCardPurchase — predates-history rejection', () => {
  it('returns a clear formError naming the history anchor date', async () => {
    const client = makeClient([OLDEST])
    const result = await registerCardPurchase({
      supabase: client,
      userId: 'user-1',
      input: {
        account_id: '11111111-1111-4111-8111-111111111111',
        amount: 5000,
        currency_code: 'ARS',
        date: '2026-04-10',
        category_id: '22222222-2222-4222-8222-222222222222',
        description: 'Consumo viejo',
      },
      today,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.formError).toContain('17/05/2026')
      expect(result.formError).toContain('anterior al primer resumen')
    }
  })
})
