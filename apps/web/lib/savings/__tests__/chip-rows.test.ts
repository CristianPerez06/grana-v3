import { describe, expect, it } from 'vitest'
import { estimateChipWidth, fitChipCount } from '@grana/savings'

/**
 * El techo de chips de propósito, que dejó de contar CHIPS para topear FILAS.
 *
 * Los tests viven acá y no en `packages/savings` porque `pnpm test` corre
 * `apps/web` y no alcanza lo que está en `packages/`.
 *
 * El ancho de referencia —320px— es el que queda en un teléfono de 360 después
 * del padding del panel, que es la pantalla contra la que se calibró todo.
 */
const NARROW = 320

describe('estimateChipWidth', () => {
  it('crece con el nombre y nunca queda por debajo del marco', () => {
    expect(estimateChipWidth('')).toBeGreaterThan(0)
    expect(estimateChipWidth('Casa')).toBeLessThan(estimateChipWidth('Meta de ahorro'))
  })

  it('sobreestima el ancho real medido contra Plus Jakarta Sans', () => {
    // Medidos con la métrica del TTF a 13px/600, más marco y emblema.
    const measured: Array<[string, number]> = [
      ['Casa', 79],
      ['Viaje', 78],
      ['Estudio', 95],
      ['Emergencia', 122],
      ['Sin destino', 116],
      ['Meta de ahorro', 142],
      ['Fondo de emergencia', 184],
    ]
    // Sobreestimar mete un chip de menos, que es un hueco; subestimar mete una
    // fila de más, que es el bug que esto cierra.
    for (const [name, real] of measured) {
      expect(estimateChipWidth(name)).toBeGreaterThanOrEqual(real)
    }
  })
})

describe('fitChipCount', () => {
  it('no pasa de las filas pedidas con los propósitos reales de la cuenta de prueba', () => {
    const names = ['Sin destino', 'Emergencia', 'Viaje', 'Casa', 'Meta de ahorro', 'Estudio', 'Aaaa']
    const count = fitChipCount(names, NARROW, 2)
    expect(count).toBeLessThan(names.length)
    expect(rowsOf(names.slice(0, count), NARROW)).toBeLessThanOrEqual(2)
  })

  it('deja entrar todos cuando entran', () => {
    expect(fitChipCount(['Casa', 'Viaje'], NARROW, 2)).toBe(2)
  })

  it('con nombres cortos aprovecha las dos filas', () => {
    const names = ['Casa', 'Viaje', 'Auto', 'Moto', 'Ropa', 'Gym', 'Libro', 'Perro']
    const count = fitChipCount(names, NARROW, 2)
    expect(count).toBeGreaterThanOrEqual(5)
    expect(rowsOf(names.slice(0, count), NARROW)).toBeLessThanOrEqual(2)
  })

  it('un nombre más ancho que la fila entra igual, ocupándola entera', () => {
    const huge = 'Un propósito con un nombre desmedidamente largo'
    expect(estimateChipWidth(huge)).toBeGreaterThan(NARROW)
    expect(fitChipCount([huge, 'Casa'], NARROW, 2)).toBe(2)
  })

  it('nunca devuelve cero, ni con una fila sola y un nombre enorme', () => {
    expect(fitChipCount(['Un nombre larguísimo que no entra'], NARROW, 1)).toBe(1)
  })

  it('una pantalla más ancha deja entrar más chips', () => {
    const names = ['Sin destino', 'Emergencia', 'Viaje', 'Casa', 'Meta de ahorro', 'Estudio', 'Aaaa']
    expect(fitChipCount(names, 470, 2)).toBeGreaterThan(fitChipCount(names, NARROW, 2))
  })

  it('lista vacía devuelve uno y no rompe', () => {
    expect(fitChipCount([], NARROW, 2)).toBe(1)
  })
})

/** Empaqueta como el navegador: greedy, sin reordenar. */
const rowsOf = (names: string[], rowWidth: number): number => {
  let rows = 1
  let used = 0
  for (const name of names) {
    const chip = estimateChipWidth(name)
    const needed = used === 0 ? chip : 6 + chip
    if (used !== 0 && used + needed > rowWidth) {
      rows += 1
      used = chip
    } else {
      used += needed
    }
  }
  return rows
}
