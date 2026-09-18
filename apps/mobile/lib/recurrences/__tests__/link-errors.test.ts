import { beforeEach, describe, expect, it, vi } from 'vitest'
import { translate } from '../../i18n'

/**
 * EL RECHAZO SE DICE CON PALABRAS, TAMBIÉN EN EL TELÉFONO.
 *
 * Registrar un pago por anticipado en nativo pasaba por un localizador que no
 * miraba el código del rechazo, así que las tres respuestas del circuito —esa
 * fecha no es un vencimiento de la regla, el plan ya no tiene lugar, ese
 * vencimiento ya está resuelto— salían todas como «algo salió mal». Web las
 * nombraba. El mismo movimiento, dos explicaciones distintas según el aparato.
 */

const impl = vi.hoisted(() => ({
  registerAhead: { ok: false } as Record<string, unknown>,
  unlink: { ok: false } as Record<string, unknown>,
}))

vi.mock('../../supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
}))

vi.mock('@grana/recurrences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@grana/recurrences')>()),
  registerRecurrenceAhead: async () => impl.registerAhead,
  unlinkMovementFromRecurrence: async () => impl.unlink,
}))

const { registerRecurrenceAhead, unlinkMovementFromRecurrence } = await import('../mutators')

/** El `t` real de la app, para que una clave que falta se vea como falla. */
const t = (key: string, values?: Record<string, string | number>) => translate('es', key, values)
const generic = translate('es', 'recurrences.errors.generic')

beforeEach(() => {
  impl.registerAhead = { ok: false }
  impl.unlink = { ok: false }
})

describe('«Ya lo pagué» — el motivo del rechazo, en nativo', () => {
  const casos = ['not_an_occurrence', 'beyond_limit', 'already_resolved'] as const

  for (const code of casos) {
    it(`dice por qué cuando el rechazo es ${code}`, async () => {
      impl.registerAhead = { ok: false, linkErrorCode: code }
      const result = await registerRecurrenceAhead({ recurrenceId: 'r1', dueDate: '2026-09-23' }, t)

      expect(result.ok).toBe(false)
      const message = result.ok ? '' : result.formError
      expect(message).toBe(translate('es', `recurrences.link.errors.${code}`))
      // Las dos cosas que salían mal: el genérico, y la clave cruda en pantalla
      // cuando el catálogo no tiene el texto.
      expect(message).not.toBe(generic)
      expect(message).not.toContain('recurrences.link')
    })
  }

  it('lo que no es un rechazo del circuito sigue cayendo en el genérico', async () => {
    impl.registerAhead = { ok: false, errorCode: '23505' }
    const result = await registerRecurrenceAhead({ recurrenceId: 'r1', dueDate: '2026-09-23' }, t)
    expect(result.ok ? '' : result.formError).toBe(generic)
  })
})

describe('desvincular — qué liquidación bloquea y cómo se destraba', () => {
  it('una completada manda a revertir', async () => {
    impl.unlink = { ok: false, errorCode: 'GRN01', blockedBy: { action: 'revert', multiple: false } }
    const result = await unlinkMovementFromRecurrence('i1', t)
    expect(result.ok ? '' : result.formError).toBe(
      translate('es', 'recurrences.link.errors.blocked_revert'),
    )
  })

  it('una pendiente propia manda a cancelar, nunca a revertir', async () => {
    impl.unlink = {
      ok: false,
      errorCode: 'GRN01',
      blockedBy: { action: 'cancel_own', multiple: false },
    }
    const result = await unlinkMovementFromRecurrence('i1', t)
    const message = result.ok ? '' : result.formError
    expect(message).toBe(translate('es', 'recurrences.link.errors.blocked_cancel_own'))
    expect(message).not.toBe(translate('es', 'recurrences.link.errors.blocked_revert'))
  })

  it('si hay varias vigentes lo agrega al mismo mensaje', async () => {
    impl.unlink = {
      ok: false,
      errorCode: 'GRN01',
      blockedBy: { action: 'cancel_other', multiple: true },
    }
    const result = await unlinkMovementFromRecurrence('i1', t)
    expect(result.ok ? '' : result.formError).toBe(
      `${translate('es', 'recurrences.link.errors.blocked_cancel_other')} ${translate(
        'es',
        'recurrences.link.errors.blocked_multiple',
      )}`,
    )
  })
})
