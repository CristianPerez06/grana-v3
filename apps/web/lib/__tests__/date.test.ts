import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDateISO, getTodayAR } from '../date'

describe('formatDateISO', () => {
  it('formats a local accounting date without UTC conversion', () => {
    expect(formatDateISO(new Date(2026, 4, 18))).toBe('2026-05-18')
  })

  it('pads month and day to keep DATE-compatible shape', () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('getTodayAR', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the AR calendar date during a regular daytime hour', () => {
    vi.setSystemTime(new Date('2026-05-21T15:00:00Z'))
    expect(formatDateISO(getTodayAR())).toBe('2026-05-21')
  })

  it('returns the AR calendar date when UTC has crossed midnight but AR has not', () => {
    vi.setSystemTime(new Date('2026-05-22T02:30:00Z'))
    expect(formatDateISO(getTodayAR())).toBe('2026-05-21')
  })

  it('returns the next AR day exactly after AR midnight', () => {
    vi.setSystemTime(new Date('2026-05-22T03:00:00Z'))
    expect(formatDateISO(getTodayAR())).toBe('2026-05-22')
  })
})
