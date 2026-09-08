import { describe, expect, it } from 'vitest'
import { derivePaidAtSnapshot } from '@grana/dashboard'

/**
 * `derivePaidAtSnapshot` — qué resúmenes estaban saldados a la fecha del corte.
 *
 * La regla existía y era correcta mientras un resumen se pagaba con UN gasto. Con pago
 * multimoneda se paga con un débito por moneda, y cada uno lleva su propia fecha: la
 * pregunta deja de ser "¿hay un pago anterior al corte?" y pasa a ser "¿salieron TODOS
 * antes del corte?".
 *
 * Lo que protege es concreto: sin esto, un resumen cuyos pesos salieron antes del corte
 * y cuyos dólares salieron después desaparecía entero de "Compromisos", con la deuda en
 * dólares todavía viva a esa fecha.
 */
const CUT = '2026-06-30'

describe('derivePaidAtSnapshot', () => {
  it('un resumen con su único débito anterior al corte está saldado', () => {
    const paid = derivePaidAtSnapshot([{ period_id: 'p1', date: '2026-06-15' }], CUT)
    expect([...paid]).toEqual(['p1'])
  })

  it('un resumen pagado después del corte seguía debiéndose', () => {
    const paid = derivePaidAtSnapshot([{ period_id: 'p1', date: '2026-07-12' }], CUT)
    expect([...paid]).toEqual([])
  })

  it('con dos débitos, si uno salió DESPUÉS del corte el resumen todavía se debía', () => {
    // Los pesos el 5, los dólares el 20 de julio: al 30 de junio faltaban los dólares.
    const paid = derivePaidAtSnapshot(
      [
        { period_id: 'p1', date: '2026-06-05' },
        { period_id: 'p1', date: '2026-07-20' },
      ],
      CUT,
    )
    expect([...paid]).toEqual([])
  })

  it('con dos débitos, ambos anteriores al corte, el resumen está saldado', () => {
    const paid = derivePaidAtSnapshot(
      [
        { period_id: 'p1', date: '2026-06-05' },
        { period_id: 'p1', date: '2026-06-20' },
      ],
      CUT,
    )
    expect([...paid]).toEqual(['p1'])
  })

  it('el día del corte cuenta como anterior', () => {
    const paid = derivePaidAtSnapshot([{ period_id: 'p1', date: CUT }], CUT)
    expect([...paid]).toEqual(['p1'])
  })

  it('una fecha ilegible se lee como pagada, que es la lectura conservadora', () => {
    const paid = derivePaidAtSnapshot([{ period_id: 'p1', date: null }], CUT)
    expect([...paid]).toEqual(['p1'])
  })

  it('una fecha ilegible NO salva a un resumen cuyo otro débito es posterior', () => {
    const paid = derivePaidAtSnapshot(
      [
        { period_id: 'p1', date: null },
        { period_id: 'p1', date: '2026-07-20' },
      ],
      CUT,
    )
    expect([...paid]).toEqual([])
  })

  it('resuelve cada resumen por separado', () => {
    const paid = derivePaidAtSnapshot(
      [
        { period_id: 'p1', date: '2026-06-05' },
        { period_id: 'p2', date: '2026-06-05' },
        { period_id: 'p2', date: '2026-07-20' },
      ],
      CUT,
    )
    expect([...paid]).toEqual(['p1'])
  })

  it('sin débitos no hay resúmenes saldados', () => {
    expect([...derivePaidAtSnapshot([], CUT)]).toEqual([])
  })
})
