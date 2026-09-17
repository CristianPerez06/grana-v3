import { describe, expect, it } from 'vitest'
import { occurrencePositionsSpent } from '../src/recurrences'

/**
 * A POSITION IS SPENT WHEN ITS DATE ARRIVES **OR** WHEN IT IS RESOLVED EARLY —
 * whichever comes first, and once either way.
 *
 * Until now the count answered only the first half: positions whose date is on
 * or before today. That was complete while nothing could resolve a vencimiento
 * ahead of its date. Registering a payment early makes it reachable, and with
 * the old reading the rule shows «0 de 3» while one of its three vencimientos is
 * already paid — the avance lags by up to a whole interval.
 *
 * The two halves are DISJOINT by construction: what the walk counts is dated on
 * or before today, and an early resolution is dated after it. So the union is a
 * sum here, and no date can be counted twice. The expectations below are worked
 * out by hand from the calendar, not copied from a run.
 */

// Un plan de tres: 23 de septiembre, 23 de octubre y 23 de noviembre.
const PLAN = {
  versions: [
    {
      effective_from: '2026-09-23',
      effective_until: null,
      anchor_date: '2026-09-23',
      interval_count: 1,
      interval_unit: 'month' as const,
    },
  ],
  pauses: [],
  endDate: null,
  maxOccurrences: 3,
  seedOccurrenceDate: null,
}

describe('occurrencePositionsSpent — resolver antes de la fecha', () => {
  it('no cuenta nada antes de que llegue el primer vencimiento', () => {
    expect(
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-03', resolvedAheadDueDates: [] }),
    ).toBe(0)
  })

  it('cuenta la posición resuelta por anticipado el día en que se resolvió', () => {
    expect(
      occurrencePositionsSpent({
        ...PLAN,
        today: '2026-09-03',
        resolvedAheadDueDates: ['2026-09-23'],
      }),
    ).toBe(1)
  })

  it('no la vuelve a contar cuando llega su fecha', () => {
    // El 23 la caminata ya la cuenta por fecha, y deja de estar «adelantada».
    // Sumar los dos conjuntos sin más daría 2 y le comería un vencimiento al plan.
    expect(
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-23', resolvedAheadDueDates: [] }),
    ).toBe(1)
  })

  it('devolver a revisión ANTES del vencimiento libera la posición', () => {
    expect(
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-05', resolvedAheadDueDates: [] }),
    ).toBe(0)
  })

  it('devolver a revisión DESPUÉS del vencimiento conserva la posición', () => {
    // Estar por revisar y haber consumido una posición son cosas distintas: el
    // calendario ya produjo ese día y ningún estado de resolución lo devuelve.
    expect(
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-25', resolvedAheadDueDates: [] }),
    ).toBe(1)
  })

  it('el plan conserva sus tres posiciones en todos los casos', () => {
    const spent = [
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-03', resolvedAheadDueDates: ['2026-09-23'] }),
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-23', resolvedAheadDueDates: [] }),
      occurrencePositionsSpent({ ...PLAN, today: '2026-09-25', resolvedAheadDueDates: [] }),
    ]
    // Nunca aparece un cuarto vencimiento: lo gastado no supera el tope.
    for (const n of spent) expect(n).toBeLessThanOrEqual(3)
  })

  it('resolver por anticipado varias posiciones las cuenta todas, una vez cada una', () => {
    expect(
      occurrencePositionsSpent({
        ...PLAN,
        today: '2026-09-03',
        resolvedAheadDueDates: ['2026-09-23', '2026-10-23'],
      }),
    ).toBe(2)
  })

  it('una fecha repetida no cuenta dos veces', () => {
    expect(
      occurrencePositionsSpent({
        ...PLAN,
        today: '2026-09-03',
        resolvedAheadDueDates: ['2026-09-23', '2026-09-23'],
      }),
    ).toBe(1)
  })

  it('no supera el tope aunque se resuelvan por anticipado más de las que caben', () => {
    expect(
      occurrencePositionsSpent({
        ...PLAN,
        today: '2026-09-03',
        resolvedAheadDueDates: ['2026-09-23', '2026-10-23', '2026-11-23', '2026-12-23'],
      }),
    ).toBe(3)
  })

  it('la semilla no se cuenta dos veces si también viene como resuelta adelantada', () => {
    // La semilla ya se cuenta por sí misma: es un movimiento real que ocupa esa
    // fecha. Si además llegara en la lista, sumarla sería contar el mismo
    // compromiso dos veces.
    expect(
      occurrencePositionsSpent({
        ...PLAN,
        today: '2026-09-03',
        seedOccurrenceDate: '2026-09-23',
        resolvedAheadDueDates: ['2026-09-23'],
      }),
    ).toBe(1)
  })
})
