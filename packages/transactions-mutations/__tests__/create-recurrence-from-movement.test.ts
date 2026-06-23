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

  // Builds a mock client around a seed expense, capturing the recurrences insert
  // payload so we can assert the shared spec (household_id + default_split) is
  // propagated from the seed's shared_expense_split rows — or left null.
  function buildClientForExpense(
    tx: Record<string, unknown>,
    splitRows: { user_id: string; percentage: number }[],
    onInsert: (payload: Record<string, unknown>) => void,
  ): GranaSupabaseClient {
    return {
      from(table: string) {
        if (table === 'transactions') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ single: async () => ({ data: tx, error: null }) }) }),
            }),
          }
        }
        if (table === 'shared_expense_split') {
          return {
            select: () => ({ eq: async () => ({ data: splitRows, error: null }) }),
          }
        }
        if (table === 'recurrences') {
          return {
            // existing-recurrence check: select().eq().in().maybeSingle()
            select: () => ({
              eq: () => ({ in: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
            // insert: insert().select().single()
            insert: (payload: Record<string, unknown>) => {
              onInsert(payload)
              return { select: () => ({ single: async () => ({ data: { id: 'rec-1' }, error: null }) }) }
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as unknown as GranaSupabaseClient
  }

  const expenseSeed = {
    id: baseInput.transaction_id,
    type: 'expense',
    account_id: '44444444-4444-4444-8444-444444444444',
    transfer_destination_account_id: null,
    amount: 100000,
    currency_code: 'ARS',
    date: '2026-06-01',
    category_id: '55555555-5555-4555-8555-555555555555',
    subcategory_id: null,
    description: 'Alquiler',
    is_parent: false,
    parent_id: null,
  }

  it('inherits the household + split when the seed movement is shared', async () => {
    const splitRows = [
      { user_id: 'user-1', percentage: 50 },
      { user_id: 'user-2', percentage: 50 },
    ]
    let payload: Record<string, unknown> | null = null
    const client = buildClientForExpense(
      { ...expenseSeed, is_shared: true, household_id: 'hh-1' },
      splitRows,
      (p) => { payload = p },
    )

    const result = await createRecurrenceFromMovement({ supabase: client, userId: 'user-1', input: baseInput })

    expect(result.ok).toBe(true)
    expect(payload!.household_id).toBe('hh-1')
    expect(payload!.default_split).toEqual(splitRows)
  })

  it('leaves the rule individual when the seed movement is not shared', async () => {
    let payload: Record<string, unknown> | null = null
    const client = buildClientForExpense(
      { ...expenseSeed, is_shared: false, household_id: null },
      [],
      (p) => { payload = p },
    )

    const result = await createRecurrenceFromMovement({ supabase: client, userId: 'user-1', input: baseInput })

    expect(result.ok).toBe(true)
    expect(payload!.household_id).toBeNull()
    expect(payload!.default_split).toBeNull()
  })
})
