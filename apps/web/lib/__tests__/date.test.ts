import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDateISO, getTodayAR, parseISODate, todayISO } from '../date'

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

describe('parseISODate', () => {
  it('parses to a local date with no UTC drift (round-trips via formatDateISO)', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2024-02-29', '2026-05-31', '2026-12-31']) {
      expect(formatDateISO(parseISODate(iso)!)).toBe(iso)
    }
  })

  it('builds the date in local time (midnight, not UTC-shifted)', () => {
    const d = parseISODate('2026-03-15')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(15)
  })

  it('returns undefined for empty or malformed input', () => {
    expect(parseISODate('')).toBeUndefined()
    expect(parseISODate(null)).toBeUndefined()
    expect(parseISODate(undefined)).toBeUndefined()
    expect(parseISODate('2026-13')).toBeUndefined()
    expect(parseISODate('15/03/2026')).toBeUndefined()
  })
})

describe('todayISO', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mirrors getTodayAR formatted as ISO', () => {
    vi.setSystemTime(new Date('2026-05-22T02:30:00Z'))
    expect(todayISO()).toBe('2026-05-21')
  })
})
