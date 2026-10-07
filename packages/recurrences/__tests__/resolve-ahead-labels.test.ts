import { describe, expect, it } from 'vitest'
import {
  RESOLVE_AHEAD_MESSAGE_KEYS,
  RESOLVE_AHEAD_MOVEMENT_TYPES,
  resolveAheadMessageKeys,
} from '../src/index'

/**
 * La elección del rótulo, que antes no existía: las tres pantallas decían
 * «Ya lo pagué» sobre cualquier regla. Sobre un sueldo, eso afirma que el
 * usuario le pagó a su sueldo.
 */
describe('cómo se nombra resolver por anticipado', () => {
  it('un gasto se paga, un ingreso se cobra y una transferencia se hace', () => {
    expect(resolveAheadMessageKeys('expense').action).toBe('already_paid.expense')
    expect(resolveAheadMessageKeys('income').action).toBe('already_paid.income')
    expect(resolveAheadMessageKeys('transfer').action).toBe('already_paid.transfer')
  })

  it('el acuse sigue al mismo tipo que el botón', () => {
    for (const kind of RESOLVE_AHEAD_MOVEMENT_TYPES) {
      const { action, recorded } = resolveAheadMessageKeys(kind)
      expect(action.endsWith(`.${kind}`)).toBe(true)
      expect(recorded.endsWith(`.${kind}`)).toBe(true)
    }
  })

  it('un tipo desconocido cae en gasto, no en una clave que no existe', () => {
    // Devolver `already_paid.settlement` dejaría la clave cruda en el botón.
    // Un rótulo levemente impreciso se lee; una clave no.
    const { action, recorded } = resolveAheadMessageKeys('settlement')
    expect(action).toBe('already_paid.expense')
    expect(recorded).toBe('recorded_success.expense')
  })

  it('la lista publicada cubre todo lo que la función puede devolver', () => {
    // Es la lista que recorre el test de catálogos: si queda corta, un tipo
    // nuevo entra sin que nadie verifique que tiene texto en los dos idiomas.
    const produced = new Set<string>()
    for (const kind of RESOLVE_AHEAD_MOVEMENT_TYPES) {
      const { action, recorded } = resolveAheadMessageKeys(kind)
      produced.add(action)
      produced.add(recorded)
    }
    expect([...produced].sort()).toEqual([...RESOLVE_AHEAD_MESSAGE_KEYS].sort())
  })
})
