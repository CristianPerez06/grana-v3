import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * LOS BOTONES CHICOS PROMETEN 44px Y TIENEN QUE DARLOS.
 *
 * `xs` y `2xs` se ven más chicos que el mínimo tocable a propósito —conviven con
 * un chip de estado dentro de una fila— y recuperan el área con `hitSlop`, que
 * es la divergencia de plataforma que el repo admite (web usa un `::after`).
 *
 * El número depende de la ALTURA de cada tamaño, y ahí estuvo el defecto: `2xs`
 * nació colgado de la misma rama que `xs` y heredó su `hitSlop`, así que medía
 * 20 + 8 + 8 = 36. Nada lo delata en pantalla —el botón se toca igual, sólo que
 * hay que apuntar—, y TypeScript no tiene nada que decir sobre aritmética que
 * no existe en el código.
 *
 * Se lee el archivo porque renderizar React Native pide un runtime que este
 * arnés no trae. Red gruesa, y la que ataja exactamente lo que pasó.
 */

const BUTTON = path.resolve(__dirname, '../../../components/ui/Button.tsx')
const MIN_TOUCH = 44

describe('área táctil de los botones compactos', () => {
  const source = readFileSync(BUTTON, 'utf-8').replace(/\r\n/g, '\n')

  /** `'2xs': 'h-5 px-2'` → 5 * 4 = 20px, la escala de Tailwind. */
  const heights = new Map<string, number>()
  const block = source.match(/const containerSize[\s\S]*?\n\}/)?.[0] ?? ''
  for (const [, size, h] of block.matchAll(/'?([\w]+)'?:\s*'h-(\d+)/g)) {
    heights.set(size, Number(h) * 4)
  }

  /** `size === 'xs' ? 8 : size === '2xs' ? 12 : undefined` */
  const slops = new Map<string, number>(
    [...source.matchAll(/size === '([\w]+)' \? (\d+)/g)].map(([, size, n]) => [size, Number(n)]),
  )

  it('el test sigue leyendo los dos mapas', () => {
    expect(heights.size, 'no se encontraron las alturas').toBeGreaterThan(0)
    expect(slops.size, 'no se encontró el hitSlop').toBeGreaterThan(0)
  })

  it('cada tamaño con hitSlop llega al mínimo tocable', () => {
    for (const [size, slop] of slops) {
      const height = heights.get(size)
      expect(height, `${size} tiene hitSlop pero no una altura fija`).toBeDefined()
      expect(
        (height ?? 0) + slop * 2,
        `${size} mide ${height}px + ${slop}px por lado = ${(height ?? 0) + slop * 2}px`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH)
    }
  })

  /**
   * `icon` mide 36px y no recupera nada. Es un hueco REAL —el mismo que `2xs`
   * tenía— pero es anterior a este change y toca todos los botones de ícono de
   * la app, así que agrandar su área acá sería un cambio de comportamiento
   * repo-wide sin nadie que lo haya probado en un aparato. Queda anotado, no
   * tapado: la regla de abajo lo nombra en vez de bajar el listón, para que un
   * tamaño NUEVO por debajo del mínimo siga cayéndose.
   */
  const CONOCIDOS_SIN_RECUPERAR = new Set(['icon'])

  it('un tamaño nuevo por debajo del mínimo no se queda sin hitSlop', () => {
    for (const [size, height] of heights) {
      if (height >= MIN_TOUCH || CONOCIDOS_SIN_RECUPERAR.has(size)) continue
      expect(slops.has(size), `${size} mide ${height}px y no recupera nada`).toBe(true)
    }
  })
})
