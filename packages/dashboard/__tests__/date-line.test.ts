import { describe, expect, it } from 'vitest'
import { dateLineVariants, isCurrentMonth, monthAndYear } from '../src/date-line'

const HOY = '2026-09-02' // miércoles
const SEP_2026 = { year: 2026, month: 9 }

describe('isCurrentMonth', () => {
  it('reconoce el mes de hoy', () => {
    expect(isCurrentMonth(HOY, SEP_2026)).toBe(true)
  })

  it('distingue el mismo mes de otro año', () => {
    expect(isCurrentMonth(HOY, { year: 2025, month: 9 })).toBe(false)
  })

  it('distingue otro mes del mismo año', () => {
    expect(isCurrentMonth(HOY, { year: 2026, month: 8 })).toBe(false)
  })
})

describe('dateLineVariants — parado en el mes corriente', () => {
  it('empieza por la fecha completa y sigue por la fecha sin día de la semana', () => {
    expect(dateLineVariants(HOY, 'es-AR', SEP_2026)).toEqual([
      'Miércoles, 2 de septiembre',
      '2 de septiembre',
    ])
  })

  it('devuelve las variantes de la más larga a la más corta', () => {
    const [larga, corta] = dateLineVariants(HOY, 'es-AR', SEP_2026)
    expect(larga!.length).toBeGreaterThan(corta!.length)
  })

  it('saca el día de la semana donde el locale lo ponga', () => {
    expect(dateLineVariants(HOY, 'en-US', SEP_2026)).toEqual([
      'Wednesday, September 2',
      'September 2',
    ])
  })

  it('NO acorta el mes: al soltar los controles la línea tiene el ancho entero', () => {
    // El acortado a tres letras era un parche para el ancho que le robaban el
    // selector y el ojito. Sin ellos, "Miércoles, 30 de septiembre" son 184px
    // de los 288px que hay a 320px: acortar sería gratuito.
    for (const variante of dateLineVariants('2026-09-30', 'es-AR', SEP_2026)) {
      expect(variante).toContain('septiembre')
    }
  })

  it('el peor caso del año conserva el mes completo en su primera variante', () => {
    // Día de la semana más largo + mes más largo + día de dos cifras.
    expect(dateLineVariants('2026-09-30', 'es-AR', SEP_2026)[0]).toBe(
      'Miércoles, 30 de septiembre',
    )
  })
})

describe('dateLineVariants — parado en otro mes', () => {
  it('nombra el mes y el año, con una sola variante', () => {
    expect(dateLineVariants(HOY, 'es-AR', { year: 2026, month: 8 })).toEqual(['Agosto 2026'])
  })

  it('no dice "al cierre": eso lo dice el rótulo de la card de saldo', () => {
    const [linea] = dateLineVariants(HOY, 'es-AR', { year: 2025, month: 12 })
    expect(linea).toBe('Diciembre 2025')
    expect(linea).not.toMatch(/cierre/i)
  })

  it('nunca ofrece una segunda variante: no hay nada que soltar', () => {
    expect(dateLineVariants(HOY, 'es-AR', { year: 2026, month: 1 })).toHaveLength(1)
  })
})

describe('monthAndYear', () => {
  it('capitaliza el mes en es-AR', () => {
    expect(monthAndYear({ year: 2026, month: 3 }, 'es-AR')).toBe('Marzo 2026')
  })

  it('funciona en en-US', () => {
    expect(monthAndYear({ year: 2026, month: 3 }, 'en-US')).toBe('March 2026')
  })
})
