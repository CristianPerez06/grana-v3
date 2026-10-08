import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE_GUARD_CODES } from '@grana/transactions-mutations'
import { translate } from '../../i18n'

/**
 * BORRAR UN MOVIMIENTO DICE POR QUÉ NO SE PUDO, TAMBIÉN EN EL TELÉFONO (#104).
 *
 * `deleteMovement` es la puerta nativa de «Eliminar» y de «Deshacer». Convertía
 * todo rechazo en «Algo salió mal», así que un consumo en un resumen pagado o una
 * liquidación de por medio se veían igual que una falla de red, y el usuario no
 * sabía qué resolver. Web los nombraba.
 */

const impl = vi.hoisted(() => ({ result: { ok: false } as Record<string, unknown> }))

vi.mock('../../supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
}))

vi.mock('@grana/recurrences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@grana/recurrences')>()),
  deleteMovementExplained: async () => impl.result,
}))

const { deleteMovement } = await import('../mutators')

const t = (key: string, values?: Record<string, string | number>) => translate('es', key, values)
const generic = translate('es', 'transactions.errors.generic')

const messageOf = async () => {
  const result = await deleteMovement('tx1', t)
  expect(result.ok).toBe(false)
  return 'formError' in result ? result.formError : ''
}

beforeEach(() => {
  impl.result = { ok: false }
})

describe('deleteMovement — el motivo del rechazo, en nativo', () => {
  it('un consumo en un resumen pagado dice que primero hay que deshacer el pago', async () => {
    impl.result = { ok: false, errorCode: DELETE_GUARD_CODES.paid }
    const message = await messageOf()
    expect(message).toBe(translate('es', 'transactions.delete_errors.paid'))
    expect(message).not.toBe(generic)
  })

  it('una liquidación pendiente propia pide cancelarla, no revertirla', async () => {
    impl.result = {
      ok: false,
      errorCode: 'GRN01',
      blockedBy: { action: 'cancel_own', multiple: false },
    }
    const message = await messageOf()
    expect(message).toBe(translate('es', 'transactions.delete_errors.blocked_cancel_own'))
    expect(message).not.toContain('transactions.delete_errors')
  })

  it('lo que no es un rechazo de borrado sigue cayendo en el genérico', async () => {
    impl.result = { ok: false, errorCode: '23505' }
    expect(await messageOf()).toBe(generic)
  })

  it('un borrado que sale bien no trae mensaje', async () => {
    impl.result = { ok: true }
    expect(await deleteMovement('tx1', t)).toEqual({ ok: true })
  })
})
