import { describe, expect, it } from 'vitest'
import { savingsPurposeSchema } from '@grana/validation'

/**
 * El schema de propósitos es `.strict()`, y en ese modo el `.trim()` de Yup NO
 * recorta: EXIGE que el string ya venga recortado. Escribir «Prueba » —un
 * espacio de más, el error de tipeo más común que hay— era rechazado en vez de
 * absorbido, y encima con un mensaje genérico.
 *
 * Estos tests fijan las dos mitades del arreglo: que el schema sigue siendo
 * estricto (no se aflojó la validación) y que la normalización previa es la que
 * absorbe el espacio.
 */
const trimName = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && 'name' in input
    ? { ...input, name: typeof input.name === 'string' ? input.name.trim() : input.name }
    : input

describe('el nombre de un propósito', () => {
  it('sin normalizar, un espacio al final lo RECHAZA: por eso hace falta el trim previo', () => {
    expect(() => savingsPurposeSchema.validateSync({ name: 'Prueba ', icon: null })).toThrow()
  })

  it('normalizado, entra y queda recortado', () => {
    const out = savingsPurposeSchema.validateSync(trimName({ name: 'Prueba ', icon: null }))
    expect(out.name).toBe('Prueba')
  })

  it('también con espacios adelante', () => {
    const out = savingsPurposeSchema.validateSync(trimName({ name: '  Viaje', icon: null }))
    expect(out.name).toBe('Viaje')
  })

  it('un nombre que era SOLO espacios sigue siendo inválido: no hay nombre', () => {
    expect(() => savingsPurposeSchema.validateSync(trimName({ name: '   ', icon: null }))).toThrow()
  })

  it('el tope de 40 se mide sobre el nombre ya recortado', () => {
    const name = `${'a'.repeat(40)}   `
    expect(savingsPurposeSchema.validateSync(trimName({ name, icon: null })).name).toHaveLength(40)
  })
})
