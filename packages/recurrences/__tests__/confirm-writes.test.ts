import { describe, expect, it, vi } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'

// El create real vive en @grana/transactions-mutations; acá solo interesa que
// devuelva un id para que la confirmación siga su curso.
vi.mock('@grana/transactions-mutations', () => ({
  createExpense: async () => ({ ok: true, id: '55555555-5555-4555-8555-555555555555' }),
  createIncome: async () => ({ ok: true, id: '55555555-5555-4555-8555-555555555555' }),
  createTransfer: async () => ({ ok: true, id: '55555555-5555-4555-8555-555555555555' }),
  registerCardPurchase: async () => ({ ok: true, id: '55555555-5555-4555-8555-555555555555' }),
  deleteTransaction: async () => ({ ok: true }),
}))

const { confirmRecurrenceInstance } = await import('../src/mutations')

/**
 * Qué escribe `confirmRecurrenceInstance`, y sobre todo qué NO escribe. Dos
 * reglas del change fix-recurrence-backlog que el código violaba:
 *
 *   1.4  Confirmar NO pisa `scheduled_date`. Antes lo sobrescribía con la fecha
 *        que el usuario elegía al confirmar, y la ocurrencia perdía su
 *        vencimiento. La fecha de pago vive en el movimiento; el vencimiento en
 *        `due_date`, que es inmutable.
 *
 *   1.4c El importe corregido vale SOLO para esa ocurrencia y no reescribe el de
 *        la regla. Con una sola pendiente por vez propagarlo pasaba por
 *        conveniente; con resolución en bloque, tres importes distintos dejarían
 *        la regla con el último procesado — un resultado dependiente del ORDEN.
 */

const USER = '00000000-0000-4000-8000-000000000000'
const INSTANCE = '11111111-1111-4111-8111-111111111111'
const RULE = '22222222-2222-4222-8222-222222222222'
const ACCOUNT = '33333333-3333-4333-8333-333333333333'
const TX = '55555555-5555-4555-8555-555555555555'

type Writes = { instance: Record<string, unknown>[]; rule: Record<string, unknown>[] }

function stubClient(writes: Writes): GranaSupabaseClient {
  const instanceRow = {
    id: INSTANCE,
    recurrence_id: RULE,
    status: 'pending',
    scheduled_date: '2026-06-23', // el VENCIMIENTO
    amount: 450000,
    account_id: ACCOUNT,
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    category_id: '44444444-4444-4444-8444-444444444444',
    subcategory_id: null,
    description: 'Alquiler',
    household_id: null,
    split: null,
  }
  const ruleRow = { id: RULE, movement_type: 'expense', amount: 450000, status: 'active' }

  return {
    from(table: string) {
      if (table === 'recurrence_instances') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: instanceRow, error: null }) }) }),
          }),
          update: (payload: Record<string, unknown>) => {
            writes.instance.push(payload)
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    select: async () => ({ data: [{ id: INSTANCE }], error: null }),
                  }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'recurrences') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: ruleRow, error: null }) }) }),
          }),
          update: (payload: Record<string, unknown>) => {
            writes.rule.push(payload)
            return { eq: async () => ({ error: null }) }
          },
        }
      }
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { type: 'bank', is_active: true }, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`tabla inesperada: ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

describe('confirmRecurrenceInstance — qué escribe y qué no', () => {
  it('1.4 · no pisa scheduled_date aunque el usuario pague en otra fecha', async () => {
    const writes: Writes = { instance: [], rule: [] }
    const result = await confirmRecurrenceInstance(stubClient(writes), USER, INSTANCE, {
      date: '2026-09-03', // pagó el 3 lo que vencía el 23/06
    })

    expect(result.ok).toBe(true)
    expect(writes.instance).toHaveLength(1)
    expect(writes.instance[0]).not.toHaveProperty('scheduled_date')
    expect(writes.instance[0]).toMatchObject({
      status: 'confirmed',
      confirmed_transaction_id: TX,
    })
  })

  it('1.4c · un importe corregido no reescribe el de la regla', async () => {
    const writes: Writes = { instance: [], rule: [] }
    const result = await confirmRecurrenceInstance(stubClient(writes), USER, INSTANCE, {
      amount: 520000, // el alquiler ajustó
    })

    expect(result.ok).toBe(true)
    // La instancia guarda el importe real de ese pago…
    expect(writes.instance[0]).toMatchObject({ amount: 520000 })
    // …y la regla no lo adopta.
    expect(writes.rule).toHaveLength(1)
    expect(writes.rule[0]).not.toHaveProperty('amount')
  })

  it('1.4c · resolver con importes distintos deja la regla igual, sea cual sea el orden', async () => {
    for (const orden of [
      [520000, 480000, 610000],
      [610000, 480000, 520000],
    ]) {
      const writes: Writes = { instance: [], rule: [] }
      for (const amount of orden) {
        await confirmRecurrenceInstance(stubClient(writes), USER, INSTANCE, { amount })
      }
      expect(writes.rule).toHaveLength(3)
      expect(writes.rule.every((w) => !('amount' in w))).toBe(true)
    }
  })
})
