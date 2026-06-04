import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { registerCardPurchase } from '../src/register-card-purchase'

/**
 * Smoke tests for the fail-fast paths. The rollback dance (expense + declared
 * reimbursement + shared splits) is covered by the manual verify pass at 9.3.
 */

const baseInput = {
  account_id: '11111111-1111-4111-8111-111111111111',
  amount: 5000,
  currency_code: 'ARS',
  date: '2026-06-01',
  category_id: '22222222-2222-4222-8222-222222222222',
  description: 'Compra simple',
}

const noopClient = {} as unknown as GranaSupabaseClient

describe('registerCardPurchase — orchestrator smoke tests', () => {
  it('returns fieldErrors when input is missing required fields', async () => {
    const result = await registerCardPurchase({
      supabase: noopClient,
      userId: 'user-1',
      input: { amount: 0 },
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeDefined()
  })

  it('returns formError when the account is not found', async () => {
    const client = {
      from(table: string) {
        if (table !== 'accounts') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }),
        }
      },
    } as unknown as GranaSupabaseClient

    const result = await registerCardPurchase({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Tarjeta no encontrada.')
  })

  it('returns formError when the account is archived', async () => {
    const client = {
      from(table: string) {
        if (table !== 'accounts') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { type: 'credit', is_active: false },
                  error: null,
                }),
              }),
            }),
          }),
        }
      },
    } as unknown as GranaSupabaseClient

    const result = await registerCardPurchase({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Esta tarjeta está archivada.')
  })
})
