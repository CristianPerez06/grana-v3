import { describe, expect, it } from 'vitest'
import {
  BLOCKING_ACTIONS,
  LINK_ERROR_MESSAGE_KEYS,
  linkErrorMessageKeys,
  type LinkErrorCode,
} from '../src/index'

/**
 * LA TABLA DE DECISIÓN DEL MENSAJE, en un solo lugar y con test.
 *
 * Estaba copiada a mano en las dos apps, y una de las dos copias se quedó atrás:
 * registrar un pago por anticipado en nativo mostraba «algo salió mal» donde web
 * decía que esa fecha no es un vencimiento de la regla. Con la decisión acá, las
 * dos superficies no pueden volver a contestar distinto.
 */

const CODES: LinkErrorCode[] = [
  'movement_incompatible',
  'movement_already_linked',
  'movement_shared_elsewhere',
  'conversion_not_confirmed',
  'not_linked',
  'not_an_occurrence',
  'beyond_limit',
  'already_resolved',
]

describe('linkErrorMessageKeys — qué mensaje corresponde a cada rechazo', () => {
  it('cada código tiene su propio mensaje, nunca el genérico', () => {
    for (const code of CODES) {
      expect(linkErrorMessageKeys({ linkErrorCode: code })).toEqual([`errors.${code}`])
    }
  })

  it('una liquidación completada manda a revertir', () => {
    expect(
      linkErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action: 'revert', multiple: false } }),
    ).toEqual(['errors.blocked_revert'])
  })

  it('una pendiente propia manda a cancelar, no a revertir', () => {
    // Revertir no es una operación que el sistema ofrezca sobre una pendiente:
    // nombrarla deja al usuario buscando un botón que no existe.
    const keys = linkErrorMessageKeys({
      errorCode: 'GRN01',
      blockedBy: { action: 'cancel_own', multiple: false },
    })
    expect(keys).toEqual(['errors.blocked_cancel_own'])
    expect(keys).not.toContain('errors.blocked_revert')
  })

  it('cuando no se pudo averiguar el estado, no aconseja revertir', () => {
    const keys = linkErrorMessageKeys({
      errorCode: 'GRN01',
      blockedBy: { action: 'unknown', multiple: false },
    })
    expect(keys).toEqual(['errors.blocked_unknown'])
    expect(keys).not.toContain('errors.blocked_revert')
  })

  it('una pendiente ajena dice que la cancela quien la registró', () => {
    expect(
      linkErrorMessageKeys({
        errorCode: 'GRN01',
        blockedBy: { action: 'cancel_other', multiple: false },
      }),
    ).toEqual(['errors.blocked_cancel_other'])
  })

  it('si hay varias vigentes lo dice, además de nombrar la acción', () => {
    expect(
      linkErrorMessageKeys({ errorCode: 'GRN01', blockedBy: { action: 'revert', multiple: true } }),
    ).toEqual(['errors.blocked_revert', 'errors.blocked_multiple'])
  })

  it('sin saber qué liquidación bloquea, dice que no sabe — no manda a revertir', () => {
    // Este test decía lo contrario, y era la suposición la que estaba mal: «el
    // caso completado es el único que el circuito produce sin `blockedBy`».
    // También lo produce un RPC que falla, y una lectura de la instancia que no
    // vuelve. En los dos casos el usuario leía «revertila» sobre algo que puede
    // ser una pendiente —que no se revierte— o ajena —que él no puede tocar—.
    //
    // El consejo más específico de los cuatro es el peor default: sólo una
    // acción `revert` explícita lo gana.
    const keys = linkErrorMessageKeys({ errorCode: 'GRN01' })
    expect(keys).toEqual(['errors.blocked_unknown'])
    expect(keys).not.toContain('errors.blocked_revert')
  })

  it('el código gana sobre el sqlstate: es la respuesta más precisa', () => {
    expect(
      linkErrorMessageKeys({ linkErrorCode: 'not_linked', errorCode: 'GRN01' }),
    ).toEqual(['errors.not_linked'])
  })

  it('un fallo que no es de este circuito devuelve null, no un mensaje inventado', () => {
    // `null` deja que quien llama conserve su propio texto (un `formError` del
    // package, o el genérico). Devolver una clave acá lo taparía.
    expect(linkErrorMessageKeys({})).toBeNull()
    expect(linkErrorMessageKeys({ errorCode: '23505' })).toBeNull()
  })

  it('la lista publicada cubre todo lo que la función puede devolver', () => {
    // Es la lista que el test de catálogos recorre: si queda corta, una clave
    // nueva entra sin que nadie verifique que existe en los dos idiomas.
    // Las acciones salen de `BLOCKING_ACTIONS`, NO de una lista escrita acá: la
    // lista a mano se quedó en tres cuando llegó `unknown`, y como al catálogo
    // también le faltaba, el test que existe para que no falte una clave pasó
    // en verde con una faltando. Derivándola, una acción nueva entra sola.
    const produced = new Set<string>()
    for (const code of CODES) produced.add(`errors.${code}`)
    for (const action of BLOCKING_ACTIONS) {
      for (const key of linkErrorMessageKeys({
        errorCode: 'GRN01',
        blockedBy: { action, multiple: true },
      }) ?? []) {
        produced.add(key)
      }
    }
    expect([...produced].sort()).toEqual([...LINK_ERROR_MESSAGE_KEYS].sort())
  })
})
