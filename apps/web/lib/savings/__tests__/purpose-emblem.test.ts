import { describe, expect, it } from 'vitest'
import { PURPOSE_TINTS, purposeGlyph, purposeTint } from '../purpose-emblem'

/**
 * El emblema es identidad, no significado. Lo único que tiene que garantizar es
 * que el mismo propósito se vea igual siempre y en todas partes — si eso se
 * rompe, no falla ningún test de plata, pero un usuario deja de reconocer
 * «Viaje» de un vistazo.
 */
describe('el tinte de un propósito', () => {
  it('es el mismo para el mismo id, siempre', () => {
    expect(purposeTint('viaje-uuid')).toBe(purposeTint('viaje-uuid'))
  })

  it('NO depende de la posición en la lista', () => {
    // La lista se ordena por monto y se reordena sola cuando cambian los
    // números. Si el tinte saliera del índice, un propósito cambiaría de color
    // porque otro creció.
    const ids = ['a-uuid', 'b-uuid', 'c-uuid']
    const antes = ids.map(purposeTint)
    const despues = [...ids].reverse().map(purposeTint).reverse()
    expect(despues).toEqual(antes)
  })

  it('siempre devuelve un tinte del set, nunca undefined', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `propósito-${i}`)
    for (const id of ids) expect(PURPOSE_TINTS).toContain(purposeTint(id))
  })

  it('reparte sobre los cinco tintes y no cae siempre en el mismo', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `propósito-${i}`)
    expect(new Set(ids.map(purposeTint)).size).toBeGreaterThan(1)
  })

  it('un id vacío no rompe: cae en el primero', () => {
    expect(PURPOSE_TINTS).toContain(purposeTint(''))
  })
})

describe('el glifo', () => {
  it('usa el emoji del propósito cuando lo tiene', () => {
    expect(purposeGlyph('✈️')).toBe('✈️')
  })

  it('cae en el frasco cuando no hay ícono, igual en toda la app', () => {
    expect(purposeGlyph(null)).toBe('🫙')
  })
})
