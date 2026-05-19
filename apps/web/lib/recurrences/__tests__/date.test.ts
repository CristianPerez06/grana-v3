import { describe, expect, it } from 'vitest'
import { getNextRecurrenceDate } from '../date'

describe('getNextRecurrenceDate', () => {
  it('adds seven days for weekly recurrences', () => {
    expect(getNextRecurrenceDate('2026-05-18', 'weekly')).toBe('2026-05-25')
  })

  it('adds fourteen days for biweekly recurrences', () => {
    expect(getNextRecurrenceDate('2026-05-18', 'biweekly')).toBe('2026-06-01')
  })

  it('keeps the day of month when the next month has it', () => {
    expect(getNextRecurrenceDate('2026-01-30', 'monthly')).toBe('2026-02-28')
    expect(getNextRecurrenceDate('2026-03-30', 'monthly')).toBe('2026-04-30')
  })

  it('clamps monthly recurrences at the end of shorter months', () => {
    expect(getNextRecurrenceDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(getNextRecurrenceDate('2024-01-31', 'monthly')).toBe('2024-02-29')
  })

  it('can preserve the original monthly anchor day after a clamped month', () => {
    expect(
      getNextRecurrenceDate('2026-02-28', 'monthly', { anchorDate: '2026-01-31' }),
    ).toBe('2026-03-31')
  })

  it('rolls monthly recurrences across year boundaries', () => {
    expect(getNextRecurrenceDate('2026-12-31', 'monthly')).toBe('2027-01-31')
  })

  it('keeps annual dates when the target year has the same month day', () => {
    expect(getNextRecurrenceDate('2026-05-18', 'annual')).toBe('2027-05-18')
  })

  it('moves February 29 annual recurrences to February 28 on non-leap years', () => {
    expect(getNextRecurrenceDate('2024-02-29', 'annual')).toBe('2025-02-28')
  })

  it('can preserve February 29 as the annual anchor for future leap years', () => {
    expect(
      getNextRecurrenceDate('2027-02-28', 'annual', { anchorDate: '2024-02-29' }),
    ).toBe('2028-02-29')
  })
})
