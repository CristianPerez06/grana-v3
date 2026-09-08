import { describe, expect, it } from 'vitest'
import {
  occurrenceAt,
  walkOccurrences,
  type OccurrenceSchedule,
} from '@grana/money-logic'

const schedule = (o: Partial<OccurrenceSchedule> = {}): OccurrenceSchedule => ({
  start_date: '2026-01-10',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  ...o,
})

describe('occurrenceAt — forma cerrada equivalente a caminar', () => {
  it('coincide con avanzar paso a paso, incluido el clamping de fin de mes', () => {
    // Regla del 31: enero → febrero recorta a 28, y marzo VUELVE al 31. Si el
    // salto acumulara el recorte, marzo caería el 28.
    const s = schedule({ start_date: '2026-01-31' })
    expect(occurrenceAt(s, 0)).toBe('2026-01-31')
    expect(occurrenceAt(s, 1)).toBe('2026-02-28')
    expect(occurrenceAt(s, 2)).toBe('2026-03-31')
    expect(occurrenceAt(s, 3)).toBe('2026-04-30')
    expect(occurrenceAt(s, 13)).toBe('2027-02-28')
  })

  it('vale para día, semana y año', () => {
    expect(occurrenceAt(schedule({ interval_unit: 'day', interval_count: 3 }), 10)).toBe('2026-02-09')
    expect(occurrenceAt(schedule({ interval_unit: 'week', interval_count: 2 }), 5)).toBe('2026-03-21')
    expect(occurrenceAt(schedule({ interval_unit: 'year', interval_count: 1 }), 4)).toBe('2030-01-10')
  })
})

describe('walkOccurrences — se posiciona en el borde, no camina desde el origen', () => {
  it('REGRESIÓN 750 pasos: una regla diaria de tres años llega igual a hoy', () => {
    // Antes, el caminante recorría desde start_date con un tope de 750 pasos, y
    // se quedaba en 2024-09-26 — 347 días ANTES del horizonte de 12 meses. El
    // generador no veía ni la ocurrencia vigente.
    const diaria = schedule({
      start_date: '2022-09-08',
      interval_unit: 'day',
      interval_count: 1,
    })
    const horizonte = '2025-09-08'
    const hoy = '2026-09-08'

    const out = walkOccurrences(diaria, { from: horizonte, to: hoy })

    expect(out[0]).toBe(horizonte)
    expect(out).toContain(hoy)
    // Sin el posicionamiento aritmético, `out` habría quedado vacío.
    expect(out.length).toBeGreaterThan(300)
  })

  it('una regla mensual vieja emite la ventana pedida y nada anterior', () => {
    const s = schedule({ start_date: '2019-03-15' })
    const out = walkOccurrences(s, { from: '2026-07-01', to: '2026-10-01' })
    expect(out).toEqual(['2026-07-15', '2026-08-15', '2026-09-15'])
  })

  it('honra el cursor: emite solo lo estrictamente posterior', () => {
    const out = walkOccurrences(schedule(), {
      from: '2026-01-01',
      to: '2026-06-01',
      cursor: '2026-03-10',
    })
    expect(out).toEqual(['2026-04-10', '2026-05-10'])
  })

  it('una pendiente no mueve el cursor, así que su fecha se sigue emitiendo', () => {
    // El cursor quedó en febrero aunque exista una pendiente de marzo.
    const out = walkOccurrences(schedule(), {
      from: '2026-01-01',
      to: '2026-04-30',
      cursor: '2026-02-10',
    })
    expect(out).toContain('2026-03-10')
  })

  it('max_occurrences cuenta desde start_date, no desde lo emitido', () => {
    // Tope de 3 ⇒ ocurrencias 0,1,2 = ene, feb, mar. Pedir desde febrero emite
    // dos, no tres: la de enero ya consumió una posición.
    const s = schedule({ max_occurrences: 3 })
    expect(walkOccurrences(s, { from: '2026-01-01' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ])
    expect(walkOccurrences(s, { from: '2026-02-01' })).toEqual([
      '2026-02-10', '2026-03-10',
    ])
  })

  it('corta por end_date', () => {
    const s = schedule({ end_date: '2026-03-15' })
    expect(walkOccurrences(s, { from: '2026-01-01' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ])
  })

  it('limit corta la emisión', () => {
    const out = walkOccurrences(schedule({ start_date: '2020-01-10' }), {
      from: '2026-01-01',
      limit: 2,
    })
    expect(out).toEqual(['2026-01-10', '2026-02-10'])
  })

  it('una ventana anterior al inicio de la regla no emite nada', () => {
    const out = walkOccurrences(schedule(), { from: '2025-01-01', to: '2025-12-01' })
    expect(out).toEqual([])
  })

  it('el clamping de fin de mes sobrevive al posicionamiento', () => {
    const s = schedule({ start_date: '2026-01-31' })
    const out = walkOccurrences(s, { from: '2027-02-01', to: '2027-04-30' })
    expect(out).toEqual(['2027-02-28', '2027-03-31', '2027-04-30'])
  })

  it('el caso #96: regla cada 3 días con el cursor clavado en junio', () => {
    // start_date elegido para que el cursor CAIGA en el cronograma: 2026-05-02
    // + 39 días = 2026-06-10. Ver el test siguiente para el caso en que no cae.
    const s = schedule({
      start_date: '2026-05-02',
      interval_unit: 'day',
      interval_count: 3,
    })
    const out = walkOccurrences(s, {
      from: '2025-09-08',        // horizonte de 12 meses
      to: '2026-09-08',          // hoy
      cursor: '2026-06-10',      // el cursor trabado
    })
    // 30 ocurrencias desde el 13/06 hasta hoy. El generador emitirá 29: la del
    // 13/06 ya existe como pendiente y la deduplica él, no el caminante.
    expect(out[0]).toBe('2026-06-13')
    expect(out[out.length - 1]).toBe('2026-09-08')
    expect(out.length).toBe(30)
  })

  it('un cursor FUERA del cronograma salta a la próxima fecha válida', () => {
    // Puede pasar si el cronograma de la regla se editó después de que el
    // cursor quedara fijado. El calendario manda: el caminante NO reanuda la
    // cadencia desde el cursor, se posiciona en la próxima ocurrencia real.
    //
    // Ojo: el generador de HOY hace lo contrario — `addInterval(cursor, …)`,
    // o sea cursor + intervalo. Las dos coinciden mientras el cursor esté sobre
    // el cronograma, que es el caso normal; cuando no lo está, divergen por
    // unos días. Anclar en el calendario es lo correcto: es la única definición
    // que no depende de cuándo se resolvió la última ocurrencia.
    const s = schedule({
      start_date: '2026-05-01',
      interval_unit: 'day',
      interval_count: 3,
    })
    // 2026-06-10 está a 40 días de start: 40 % 3 = 1 ⇒ no cae en el cronograma.
    const out = walkOccurrences(s, { from: '2026-06-01', to: '2026-06-20', cursor: '2026-06-10' })
    expect(out[0]).toBe('2026-06-12')   // la próxima ocurrencia real, no 06-13
  })
})
