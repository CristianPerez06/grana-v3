import { describe, expect, it } from 'vitest'
import { recurrenceTitle } from '../src/display-title'

/**
 * THE ORDER IN WHICH A RULE IS NAMED, pinned here so it cannot be retyped
 * differently on the tenth surface. Every case below is a step of the chain
 * losing to the one before it.
 */
describe('recurrenceTitle', () => {
  it('la descripción le gana a todo', () => {
    expect(
      recurrenceTitle({
        description: 'Fibra hogar',
        subcategory: 'Internet',
        category: 'Servicios',
        type: 'Gasto',
      }),
    ).toBe('Fibra hogar')
  })

  it('sin descripción, la subcategoría le gana a la categoría', () => {
    // This is the whole point of the change: "Internet" identifies the rule,
    // "Servicios" is what three different rules would all be called.
    expect(
      recurrenceTitle({ description: null, subcategory: 'Internet', category: 'Servicios', type: 'Gasto' }),
    ).toBe('Internet')
  })

  it('sin subcategoría, cae en la categoría', () => {
    expect(
      recurrenceTitle({ description: null, subcategory: null, category: 'Servicios', type: 'Gasto' }),
    ).toBe('Servicios')
  })

  it('sin clasificación, cae en la etiqueta del tipo', () => {
    // A transfer has no category at all, so this is its normal name — not an
    // edge case.
    expect(
      recurrenceTitle({ description: null, subcategory: null, category: null, type: 'Transferencia' }),
    ).toBe('Transferencia')
  })

  it('en blanco es lo mismo que ausente', () => {
    // A form that submitted spaces stores them. " " is not a name, and taking it
    // would paint an empty row instead of falling through.
    expect(
      recurrenceTitle({ description: '   ', subcategory: '', category: 'Servicios', type: 'Gasto' }),
    ).toBe('Servicios')
  })

  it('recorta lo que devuelve', () => {
    expect(recurrenceTitle({ description: '  Fibra hogar  ' })).toBe('Fibra hogar')
  })

  it('sin nada que decir devuelve null, y no una cadena vacía', () => {
    // `null` is what lets the caller add its own last resort; an empty string
    // would paint a nameless row and look like a rendering bug.
    expect(recurrenceTitle({})).toBeNull()
    expect(recurrenceTitle({ description: null, subcategory: null, category: null, type: null })).toBeNull()
  })
})
