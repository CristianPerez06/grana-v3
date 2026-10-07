import { describe, expect, it } from 'vitest'
import { formatCompactDate } from '../src/compact-date'

const TODAY = '2026-10-07'

describe('formatCompactDate', () => {
  it('drops the year when it is this year', () => {
    expect(formatCompactDate('2026-12-01', TODAY, 'es')).toBe('1 dic')
    expect(formatCompactDate('2026-10-15', TODAY, 'es')).toBe('15 oct')
  })

  it('keeps the year when it is not this year', () => {
    expect(formatCompactDate('2027-01-20', TODAY, 'es')).toBe('20 ene 2027')
  })

  it('reads the date off the string, never through a UTC Date', () => {
    // `new Date('2026-12-01')` is UTC midnight: in AR it reads as 30 nov.
    expect(formatCompactDate('2026-12-01', TODAY, 'es')).not.toContain('30')
  })

  it('orders month first in English', () => {
    expect(formatCompactDate('2026-12-01', TODAY, 'en')).toBe('Dec 1')
  })
})
