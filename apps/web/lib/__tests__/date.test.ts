import { describe, expect, it } from 'vitest'
import { formatDateISO } from '../date'

describe('formatDateISO', () => {
  it('formats a local accounting date without UTC conversion', () => {
    expect(formatDateISO(new Date(2026, 4, 18))).toBe('2026-05-18')
  })

  it('pads month and day to keep DATE-compatible shape', () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
