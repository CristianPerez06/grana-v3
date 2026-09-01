import { describe, expect, it } from 'vitest'
import { formatTodayLine } from '../src/today-line'

describe('formatTodayLine', () => {
  it('capitalizes the full es-AR line', () => {
    expect(formatTodayLine('2026-09-01', 'es-AR')).toBe('Martes, 1 de septiembre')
  })

  it('trims the month to three letters when asked', () => {
    expect(formatTodayLine('2026-09-01', 'es-AR', { shortMonth: true })).toBe('Martes, 1 de sep')
  })

  it('trims the month wherever the locale puts it', () => {
    expect(formatTodayLine('2026-09-01', 'en-US', { shortMonth: true })).toBe('Tuesday, Sep 1')
  })

  it('leaves months of three letters or fewer alone', () => {
    // "mayo" -> "may" is still a trim; "May" in en-US is already at the floor.
    expect(formatTodayLine('2026-05-04', 'en-US', { shortMonth: true })).toBe('Monday, May 4')
    expect(formatTodayLine('2026-05-04', 'es-AR', { shortMonth: true })).toBe('Lunes, 4 de may')
  })

  it('reads the date as local wall time, not UTC', () => {
    // A `YYYY-MM-DD` parsed as an instant lands on the previous day west of
    // Greenwich; the accounting date must name the day the user is having.
    expect(formatTodayLine('2026-01-01', 'es-AR')).toBe('Jueves, 1 de enero')
  })
})
