import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { createRecurrenceFromMovement } from '../src/create-recurrence-from-movement'

/**
 * Smoke tests for the fail-fast paths (validation + seed-transaction guards).
 * The single-row insert path is covered by the manual verify pass at 9.3.
 */

const baseInput = {
  transaction_id: '33333333-3333-4333-8333-333333333333',
  frequency: 'monthly',
}

const noopClient = {} as unknown as GranaSupabaseClient

describe('createRecurrenceFromMovement — orchestrator smoke tests', () => {
  it('returns fieldErrors when input is missing required fields', async () => {
    const result = await createRecurrenceFromMovement({
      supabase: noopClient,
      userId: 'user-1',
      input: {},
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeDefined()
  })

  it('returns formError when the seed transaction is not found', async () => {
    const client = {
      from(table: string) {
        if (table !== 'transactions') throw new Error(`unexpected table ${table}`)
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

    const result = await createRecurrenceFromMovement({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Movimiento no encontrado.')
  })

  it('rejects adjustments as seed transactions', async () => {
    const client = {
      from(table: string) {
        if (table !== 'transactions') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: baseInput.transaction_id,
                    type: 'adjustment',
                    account_id: '44444444-4444-4444-4444-444444444444',
                    transfer_destination_account_id: null,
                    amount: 100,
                    currency_code: 'ARS',
                    date: '2026-06-01',
                    category_id: null,
                    subcategory_id: null,
                    description: null,
                    is_parent: false,
                    parent_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      },
    } as unknown as GranaSupabaseClient

    const result = await createRecurrenceFromMovement({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Los ajustes no admiten recurrencias.')
  })
})
