import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { canUnlink, recurrenceLinkLabelKey } from '../src/review-surface'
import { blockingAction, describeBlockingSettlements } from '../src/link'

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
//
// QUÉ liquidaciones bloquean ya no se decide acá: la cobertura —hogar, moneda,
// fecha y vigencia— la resuelve `settlements_blocking_movement` (0073), que es
// el único que las ve todas. Un miembro, por su cuenta, no ve la fecha de una
// liquidación que registró el otro. Lo que queda acá es la decisión: con estas
// filas, qué se le ofrece al usuario. Se prueba sobre la función pura.

const row = (
  id: string,
  status: 'completed' | 'pending_receipt' | 'reversed',
  payerId: string,
) => ({ id, status, payer_id: payerId })

describe('blockingAction', () => {
  it('no reporta nada cuando ninguna liquidación bloquea', () => {
    expect(blockingAction([], YO)).toBeNull()
  })

  it('una completada se revierte', () => {
    expect(blockingAction([row('s1', 'completed', YO)], YO)).toEqual({
      action: 'revert',
      multiple: false,
    })
  })

  it('una pendiente propia se cancela, no se revierte', () => {
    // `reverse_settlement` sólo acepta completadas: decir «revertí» acá manda al
    // usuario a una operación que el sistema no ofrece para ese estado.
    expect(blockingAction([row('s1', 'pending_receipt', YO)], YO)).toEqual({
      action: 'cancel_own',
      multiple: false,
    })
  })

  it('una pendiente del otro miembro no se le pide al usuario', () => {
    expect(blockingAction([row('s1', 'pending_receipt', EL_OTRO)], YO)).toEqual({
      action: 'cancel_other',
      multiple: false,
    })
  })

  it('nombra primero lo que el usuario puede hacer', () => {
    // Con una pendiente ajena y una completada, decir «que la cancele el otro»
    // lo dejaría esperando a alguien cuando él mismo puede destrabarlo.
    expect(
      blockingAction([row('s1', 'pending_receipt', EL_OTRO), row('s2', 'completed', YO)], YO),
    ).toEqual({ action: 'revert', multiple: true })
  })

  it('avisa cuando bloquea más de una', () => {
    // Resolver una y volver a chocar con la siguiente, sin aviso, se lee como que
    // la primera no sirvió de nada.
    const result = blockingAction([row('s1', 'completed', YO), row('s2', 'completed', YO)], YO)
    expect(result?.multiple).toBe(true)
  })

  it('una reversión a medio escribir se trata como completada', () => {
    // `settlement_is_live` protege una `reversed` sin su contraasiento. No se
    // cancela: lo que falta es terminar la reversión.
    expect(blockingAction([row('s1', 'reversed', EL_OTRO)], YO)).toEqual({
      action: 'revert',
      multiple: false,
    })
  })
})

describe('describeBlockingSettlements', () => {
  const clientReturning = (rows: unknown[]) =>
    ({ rpc: async () => ({ data: rows }) }) as unknown as GranaSupabaseClient

  it('pregunta por RPC y traduce la respuesta a una acción', async () => {
    const client = clientReturning([row('s1', 'pending_receipt', EL_OTRO)])
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'cancel_other',
      multiple: false,
    })
  })

  it('no reporta nada cuando el RPC no devuelve nada', async () => {
    // Movimiento personal, o ninguna liquidación que lo cubra: el RPC contesta
    // vacío en los dos casos y no hay nada que aconsejar.
    const client = clientReturning([])
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toBeNull()
  })

  it('si el RPC falla dice que no sabe, en vez de caer en «revertí»', async () => {
    // NO SABER NO ES NO HABER: la guarda ya rechazó, así que hay una liquidación
    // vigente seguro. Devolver null acá dejaba el mensaje en su rama por
    // defecto, que aconseja revertir — justo lo que no corresponde si lo que
    // traba es una pendiente.
    const client = {
      rpc: async () => ({ data: null, error: { message: 'boom' } }),
    } as unknown as GranaSupabaseClient
    expect(await describeBlockingSettlements(client, { transactionId: MOV, userId: YO })).toEqual({
      action: 'unknown',
      multiple: false,
    })
  })
})
