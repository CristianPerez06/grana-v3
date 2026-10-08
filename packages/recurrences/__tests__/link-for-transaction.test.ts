import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { getRecurrenceLinkForTransaction, occurrenceAfterDelete } from '../src/queries'

/**
 * What a movement's detail knows before deleting it: which occurrence it
 * resolves and what happens to it. The query's shape is pinned with a fake
 * client that hands back the row PostgREST would; the decision is pure.
 */

const fakeClient = (row: unknown): GranaSupabaseClient => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  }
  return { from: () => chain } as unknown as GranaSupabaseClient
}

const CINE = {
  id: 'c1',
  name: 'Entretenimiento',
  canonical_name: 'entertainment',
  color: null,
  icon: null,
  user_id: null,
}

describe('getRecurrenceLinkForTransaction', () => {
  it('devuelve el vencimiento y los datos con que se nombra la regla', async () => {
    const link = await getRecurrenceLinkForTransaction(
      fakeClient({
        recurrence_id: 'r1',
        resolution_kind: 'created',
        due_date: '2026-09-10',
        recurrence: {
          movement_type: 'expense',
          frequency: 'monthly',
          status: 'active',
          description: 'Celular',
          category: CINE,
          subcategory: null,
        },
      }),
      'tx1',
    )
    expect(link).toEqual({
      recurrence_id: 'r1',
      movement_type: 'expense',
      frequency: 'monthly',
      resolution_kind: 'created',
      due_date: '2026-09-10',
      rule: { status: 'active', description: 'Celular', category: CINE, subcategory: null },
    })
  })

  it('un pago anterior a 0064 trae el vencimiento en null', async () => {
    const link = await getRecurrenceLinkForTransaction(
      fakeClient({
        recurrence_id: 'r1',
        resolution_kind: 'created',
        due_date: null,
        recurrence: {
          movement_type: 'expense',
          frequency: 'monthly',
          status: 'active',
          description: null,
          category: null,
          subcategory: null,
        },
      }),
      'tx1',
    )
    expect(link?.due_date).toBeNull()
  })

  it('un movimiento sin recurrencia no trae nada', async () => {
    expect(await getRecurrenceLinkForTransaction(fakeClient(null), 'tx1')).toBeNull()
  })
})

describe('occurrenceAfterDelete', () => {
  it('vuelve a revisión cuando se conoce el vencimiento y la regla sigue', () => {
    expect(occurrenceAfterDelete({ due_date: '2026-09-10', rule: { status: 'active' } })).toBe(
      'back_to_review',
    )
    expect(occurrenceAfterDelete({ due_date: '2026-09-10', rule: { status: 'paused' } })).toBe(
      'back_to_review',
    )
  })

  it('sale del historial si el vencimiento es desconocido', () => {
    expect(occurrenceAfterDelete({ due_date: null, rule: { status: 'active' } })).toBe(
      'leaves_history',
    )
  })

  it('sale del historial si la regla fue eliminada', () => {
    expect(occurrenceAfterDelete({ due_date: '2026-09-10', rule: { status: 'deleted' } })).toBe(
      'leaves_history',
    )
  })
})
