import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { canUnlink, recurrenceLinkLabelKey } from '../src/review-surface'
import { describeBlockingSettlements } from '../src/link'

const YO = '00000000-0000-0000-0000-0000000000a1'
const EL_OTRO = '00000000-0000-0000-0000-0000000000b2'
const MOV = '11111111-1111-4111-8111-111111111111'

// ── Qué acción se ofrece ─────────────────────────────────────────────────────

describe('canUnlink', () => {
  it('ofrece desvincular sobre lo que el usuario vinculó', () => {
    expect(canUnlink({ status: 'confirmed', resolution_kind: 'linked' })).toBe(true)
  })

  it('NO lo ofrece sobre un pago que creó la recurrencia', () => {
    // Deshacerlo significaría borrar un gasto real del historial del usuario.
    expect(canUnlink({ status: 'confirmed', resolution_kind: 'created' })).toBe(false)
  })

  it('no lo ofrece sobre una ocurrencia sin resolver ni sobre una omitida', () => {
    expect(canUnlink({ status: 'pending', resolution_kind: null })).toBe(false)
    expect(canUnlink({ status: 'skipped', resolution_kind: null })).toBe(false)
  })
})

describe('recurrenceLinkLabelKey', () => {
  it('llama vinculado a lo que el usuario vinculó, y originado a lo demás', () => {
    expect(recurrenceLinkLabelKey('linked')).toBe('linked')
    expect(recurrenceLinkLabelKey('created')).toBe('originated')
    expect(recurrenceLinkLabelKey(null)).toBe('originated')
  })
})

// ── Qué liquidación bloquea, y qué se puede hacer con ella ───────────────────

type Settlement = {
  id: string
  status: 'completed' | 'pending_receipt'
  payer_id: string
  legDate: string
}

const clientWith = (settlements: Settlement[], movement: Record<string, unknown> | null) =>
  ({
    from: (table: string) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: movement }) }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: async () => ({
                data: settlements.map((s) => ({
                  id: s.id,
                  status: s.status,
                  payer_id: s.payer_id,
                  payer_movement_id: `leg-${s.id}`,
                  transactions: { date: s.legDate },
                })),
              }),
            }),
          }),
        }),
      }
    },
  }) as unknown as GranaSupabaseClient

const GASTO = { household_id: 'h1', currency_code: 'ARS', date: '2026-09-10', due_date: null }

describe('describeBlockingSettlements', () => {
  it('no reporta nada sobre un movimiento personal', async () => {
    const client = clientWith([], { ...GASTO, household_id: null })
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toBeNull()
  })

  it('no reporta nada cuando ninguna liquidación cubre la fecha', async () => {
    const client = clientWith(
      [{ id: 's1', status: 'completed', payer_id: YO, legDate: '2026-09-01' }],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toBeNull()
  })

  it('una completada se revierte', async () => {
    const client = clientWith(
      [{ id: 's1', status: 'completed', payer_id: YO, legDate: '2026-09-20' }],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'revert',
      multiple: false,
    })
  })

  it('una pendiente propia se cancela, no se revierte', async () => {
    // `reverse_settlement` sólo acepta completadas: decir «revertí» acá manda al
    // usuario a una operación que el sistema no ofrece para ese estado.
    const client = clientWith(
      [{ id: 's1', status: 'pending_receipt', payer_id: YO, legDate: '2026-09-20' }],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'cancel_own',
      multiple: false,
    })
  })

  it('una pendiente del otro miembro no se le pide al usuario', async () => {
    const client = clientWith(
      [{ id: 's1', status: 'pending_receipt', payer_id: EL_OTRO, legDate: '2026-09-20' }],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'cancel_other',
      multiple: false,
    })
  })

  it('nombra primero lo que el usuario puede hacer', async () => {
    // Con una pendiente ajena y una completada, decir «que la cancele el otro»
    // lo dejaría esperando a alguien cuando él mismo puede destrabarlo.
    const client = clientWith(
      [
        { id: 's1', status: 'pending_receipt', payer_id: EL_OTRO, legDate: '2026-09-20' },
        { id: 's2', status: 'completed', payer_id: YO, legDate: '2026-09-21' },
      ],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'revert',
      multiple: true,
    })
  })

  it('avisa cuando bloquea más de una', async () => {
    // Resolver una y volver a chocar con la siguiente, sin aviso, se lee como que
    // la primera no sirvió de nada.
    const client = clientWith(
      [
        { id: 's1', status: 'completed', payer_id: YO, legDate: '2026-09-20' },
        { id: 's2', status: 'completed', payer_id: YO, legDate: '2026-09-21' },
      ],
      GASTO,
    )
    const result = await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })
    expect(result?.multiple).toBe(true)
  })

  it('una liquidación del mismo día que el gasto ya lo cubre', async () => {
    const client = clientWith(
      [{ id: 's1', status: 'completed', payer_id: YO, legDate: '2026-09-10' }],
      GASTO,
    )
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'revert',
      multiple: false,
    })
  })
})
