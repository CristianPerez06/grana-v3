import { describe, expect, it } from 'vitest'
import { MONTHS_BACK, reachableMonths } from '../src/month-range'

const HOY = '2026-09-02'

const buscar = (años: ReturnType<typeof reachableMonths>, year: number, month: number) =>
  años.find((a) => a.year === year)!.months.find((m) => m.month === month)!

describe('reachableMonths', () => {
  it('devuelve los años abarcados, el más nuevo primero', () => {
    expect(reachableMonths(HOY, 'es-AR').map((a) => a.year)).toEqual([2026, 2025])
  })

  it('devuelve los doce meses de cada año, no solo los alcanzables', () => {
    // Los no alcanzables se renderizan deshabilitados: así la regla se ve, en
    // lugar de descubrirse tocando un control muerto.
    for (const año of reachableMonths(HOY, 'es-AR')) {
      expect(año.months).toHaveLength(12)
    }
  })

  it('marca el mes de hoy como alcanzable', () => {
    expect(buscar(reachableMonths(HOY, 'es-AR'), 2026, 9).reachable).toBe(true)
  })

  it('no alcanza ningún mes futuro', () => {
    const años = reachableMonths(HOY, 'es-AR')
    for (const mes of [10, 11, 12]) {
      expect(buscar(años, 2026, mes).reachable).toBe(false)
    }
  })

  it('alcanza exactamente 12 meses hacia atrás, y ni uno más', () => {
    const años = reachableMonths(HOY, 'es-AR')
    // Septiembre 2025 es el mes 12 hacia atrás: entra.
    expect(buscar(años, 2025, 9).reachable).toBe(true)
    // Agosto 2025 es el 13: no entra.
    expect(buscar(años, 2025, 8).reachable).toBe(false)
  })

  it('el total de meses alcanzables es MONTHS_BACK + el corriente', () => {
    const alcanzables = reachableMonths(HOY, 'es-AR')
      .flatMap((a) => a.months)
      .filter((m) => m.reachable)
    expect(alcanzables).toHaveLength(MONTHS_BACK + 1)
  })

  it('etiqueta cada mes con tres letras capitalizadas del locale', () => {
    const años = reachableMonths(HOY, 'es-AR')
    expect(buscar(años, 2026, 9).label).toBe('Sep')
    expect(buscar(años, 2026, 1).label).toBe('Ene')
    expect(buscar(años, 2026, 12).label).toBe('Dic')
  })

  it('etiqueta en el locale que se le pase', () => {
    const años = reachableMonths(HOY, 'en-US')
    expect(buscar(años, 2026, 1).label).toBe('Jan')
    expect(buscar(años, 2026, 8).label).toBe('Aug')
  })

  it('cruza el año correctamente parado en enero', () => {
    const años = reachableMonths('2026-01-15', 'es-AR')
    expect(años.map((a) => a.year)).toEqual([2026, 2025])
    expect(buscar(años, 2026, 1).reachable).toBe(true)
    expect(buscar(años, 2026, 2).reachable).toBe(false)
    expect(buscar(años, 2025, 1).reachable).toBe(true)
    expect(años.map((a) => a.year)).not.toContain(2024)
  })

  it('parado en diciembre sigue abarcando dos años', () => {
    const años = reachableMonths('2026-12-31', 'es-AR')
    expect(años.map((a) => a.year)).toEqual([2026, 2025])
    expect(buscar(años, 2026, 12).reachable).toBe(true)
    expect(buscar(años, 2025, 12).reachable).toBe(true)
    expect(buscar(años, 2025, 11).reachable).toBe(false)
  })
})
