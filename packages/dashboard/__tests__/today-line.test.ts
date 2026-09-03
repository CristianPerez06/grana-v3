import { describe, expect, it } from 'vitest'
import { formatTodayLine } from '../src/today-line'

describe('formatTodayLine', () => {
  it('capitalizes the full es-AR line', () => {
    expect(formatTodayLine('2026-09-01', 'es-AR')).toBe('Martes, 1 de septiembre')
  })

  it('trims both the weekday and the month when asked', () => {
    expect(formatTodayLine('2026-09-01', 'es-AR', { short: true })).toBe('Mar, 1 de sep')
  })

  it('trims the longest weekday, which is what the narrow row has to fit', () => {
    // "Miércoles, 2 de sep" (109px) was what truncated in production; trimming
    // the month alone was sized against "Martes" (92px) and did not cover it.
    expect(formatTodayLine('2026-09-02', 'es-AR', { short: true })).toBe('Mié, 2 de sep')
    expect(formatTodayLine('2026-09-06', 'es-AR', { short: true })).toBe('Dom, 6 de sep')
  })

  it('trims each part wherever the locale puts it', () => {
    expect(formatTodayLine('2026-09-02', 'en-US', { short: true })).toBe('Wed, Sep 2')
  })

  it('leaves parts of three letters or fewer alone', () => {
    // "May" in en-US is already at the floor; "mayo" still trims to "may".
    expect(formatTodayLine('2026-05-04', 'en-US', { short: true })).toBe('Mon, May 4')
    expect(formatTodayLine('2026-05-04', 'es-AR', { short: true })).toBe('Lun, 4 de may')
  })

  it('reads the date as local wall time, not UTC', () => {
    // A `YYYY-MM-DD` parsed as an instant lands on the previous day west of
    // Greenwich; the accounting date must name the day the user is having.
    expect(formatTodayLine('2026-01-01', 'es-AR')).toBe('Jueves, 1 de enero')
  })
})
