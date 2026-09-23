import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'

const TX = '55555555-5555-4555-8555-555555555555'
const REGLA = '22222222-2222-4222-8222-222222222222'
const VENCE = '2026-09-23'

const createFails = vi.hoisted(() => ({ value: false }))

vi.mock('@grana/transactions-mutations', () => {
  const make = async () =>
    createFails.value ? { ok: false, formError: 'no se pudo' } : { ok: true, id: TX }
  return {
    createExpense: make,
    createIncome: make,
    createTransfer: make,
    registerCardPurchase: make,
    deleteTransaction: async () => ({ ok: true }),
  }
})

const { registerRecurrenceAhead } = await import('../src/link')

type Written = { table: string; op: 'insert' | 'update'; payload: Record<string, unknown> }

let written: Written[]
let deleted: string[]
let instanceWriteFails: boolean
/** Lo que contesta `recurrence_admits_occurrence`: null = se puede. */
let admits: string | null

const RULE = {
  id: REGLA,
  movement_type: 'expense',
  amount: 1000,
  status: 'active',
  account_id: 'acc-1',
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  category_id: 'cat-1',
  subcategory_id: null,
  description: 'Alquiler',
  household_id: null,
  default_split: null,
}

const client = () =>
  ({
    rpc: async (name: string) => {
      if (name !== 'recurrence_admits_occurrence') throw new Error(`rpc inesperado: ${name}`)
      return { data: admits, error: null }
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_c: string, value: string) => ({
          eq: () => ({
            single: async () =>
              table === 'recurrences'
                ? { data: RULE, error: null }
                : { data: { type: 'cash', is_active: true }, error: null },
            maybeSingle: async () => ({ data: null }),
          }),
          // `.eq(...).eq(...).maybeSingle()` para la ocurrencia existente.
          maybeSingle: async () => ({ data: null }),
          single: async () =>
            table === 'accounts'
              ? { data: { type: 'cash', is_active: true }, error: null }
              : { data: RULE, error: null },
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        written.push({ table, op: 'insert', payload })
        return {
          select: async () =>
            instanceWriteFails
              ? { data: null, error: { message: 'boom' } }
              : { data: [{ id: 'inst-1' }], error: null },
        }
      },
      update: (payload: Record<string, unknown>) => {
        written.push({ table, op: 'update', payload })
        return {
          eq: () => ({
            eq: () => ({ select: async () => ({ data: [{ id: 'inst-1' }], error: null }) }),
          }),
        }
      },
      delete: () => ({
        eq: async (_c: string, id: string) => {
          deleted.push(id)
          return { error: null }
        },
      }),
    }),
  }) as unknown as GranaSupabaseClient

beforeEach(() => {
  written = []
  deleted = []
  instanceWriteFails = false
  createFails.value = false
  admits = null
})

describe('registerRecurrenceAhead', () => {
  it('escribe la ocurrencia YA RESUELTA, nunca pendiente', async () => {
    // Una ocurrencia pendiente fechada en el futuro aparecería en el bloque de
    // vencimientos por revisar, pidiéndole al usuario algo que acaba de pagar.
    const result = await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: VENCE,
      date: '2026-09-03',
    })

    expect(result.ok).toBe(true)
    const instance = written.find((w) => w.table === 'recurrence_instances')
    expect(instance?.payload.status).toBe('confirmed')
    expect(instance?.payload.confirmed_transaction_id).toBe(TX)
    // Ninguna escritura deja el estado pendiente en ningún momento.
    expect(written.some((w) => w.payload.status === 'pending')).toBe(false)
  })

  it('conserva el vencimiento y usa la fecha de pago para el movimiento', async () => {
    await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: VENCE,
      date: '2026-09-03',
    })
    const instance = written.find((w) => w.table === 'recurrence_instances')
    // El vencimiento es la identidad de la ocurrencia y no se mueve; la fecha de
    // pago viaja en el movimiento, que es otro hecho.
    expect(instance?.payload.due_date).toBe(VENCE)
  })

  it('marca la resolución como creada por la recurrencia', async () => {
    await registerRecurrenceAhead(client(), 'u1', { recurrenceId: REGLA, dueDate: VENCE })
    const instance = written.find((w) => w.table === 'recurrence_instances')
    expect(instance?.payload.resolution_kind).toBe('created')
  })

  it('valida el vencimiento ANTES de crear el movimiento, con la misma regla SQL que vincular', async () => {
    // Rechazar después dejaría un gasto huérfano que compensar. Y la regla es una
    // sola —`recurrence_admits_occurrence`— para que registrar por anticipado y
    // vincular no puedan contestar distinto sobre la misma fecha.
    admits = 'not_an_occurrence'
    const result = await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: '2026-09-15',
    })
    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.linkErrorCode).toBe('not_an_occurrence')
    // Ni movimiento ni ocurrencia.
    expect(written).toHaveLength(0)
    expect(deleted).toHaveLength(0)
  })

  it('una posición más allá del tope se rechaza igual', async () => {
    admits = 'beyond_limit'
    const result = await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: '2026-12-23',
    })
    expect(result.ok).toBe(false)
    expect(written).toHaveLength(0)
  })

  it('si falla el alta del movimiento no escribe ninguna ocurrencia', async () => {
    createFails.value = true
    const result = await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: VENCE,
    })
    expect(result.ok).toBe(false)
    expect(written.some((w) => w.table === 'recurrence_instances')).toBe(false)
  })

  it('si falla la escritura de la ocurrencia, borra el movimiento que creó', async () => {
    // Sin la compensación queda un movimiento huérfano que el usuario no puede
    // relacionar con nada.
    instanceWriteFails = true
    const result = await registerRecurrenceAhead(client(), 'u1', {
      recurrenceId: REGLA,
      dueDate: VENCE,
    })
    expect(result.ok).toBe(false)
    expect(deleted).toContain(TX)
  })
})
