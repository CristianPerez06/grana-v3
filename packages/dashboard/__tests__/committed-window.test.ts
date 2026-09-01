import { describe, expect, it } from 'vitest'
import { resolveCommittedWindow } from '../src/committed-window'

// ═══════════════════════════════════════════════════════════════════════════
// The two dates and the two flags the committed card reads from.
//
// `lens` and `windowElapsed` are deliberately NOT derived from each other, and
// the case that proves why is the FIRST OF A MONTH looking at the previous one:
// the window is the month now running, so it has not elapsed — but the cut is
// still the previous month's close. A single field taken from "has the window
// ended?" reports the live reading there and throws the cut away.
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveCommittedWindow — the three navigator positions', () => {
  it('current month: cut at today, window next month, live', () => {
    expect(resolveCommittedWindow({ year: 2026, month: 9, todayISO: '2026-09-15' })).toEqual({
      window: { start: '2026-10-01', end: '2026-10-31' },
      snapshotDate: '2026-09-15',
      lens: 'live',
      windowElapsed: false,
    })
  })

  it('previous month: cut at its close, window still running', () => {
    expect(resolveCommittedWindow({ year: 2026, month: 8, todayISO: '2026-09-15' })).toEqual({
      window: { start: '2026-09-01', end: '2026-09-30' },
      snapshotDate: '2026-08-31',
      lens: 'snapshot',
      windowElapsed: false,
    })
  })

  it('further back: cut at its close, window already elapsed', () => {
    expect(resolveCommittedWindow({ year: 2026, month: 6, todayISO: '2026-09-15' })).toEqual({
      window: { start: '2026-07-01', end: '2026-07-31' },
      snapshotDate: '2026-06-30',
      lens: 'snapshot',
      windowElapsed: true,
    })
  })
})

describe('resolveCommittedWindow — the case a single field got wrong', () => {
  it('on the 1st, looking at the previous month: snapshot lens, window not elapsed', () => {
    const resolved = resolveCommittedWindow({ year: 2026, month: 8, todayISO: '2026-09-01' })
    expect(resolved.snapshotDate).toBe('2026-08-31')
    expect(resolved.lens).toBe('snapshot')
    // A `mode` taken from `window.end < today` would say "current" here, and the
    // 31/08 cut above would be computed and then ignored.
    expect(resolved.windowElapsed).toBe(false)
  })

  it('on the last day of a window, it has still not elapsed', () => {
    const resolved = resolveCommittedWindow({ year: 2026, month: 8, todayISO: '2026-09-30' })
    expect(resolved.window.end).toBe('2026-09-30')
    expect(resolved.windowElapsed).toBe(false)
  })
})

describe('resolveCommittedWindow — the cut always precedes the window', () => {
  // What makes this card and the balance card above it comparable: the balance
  // cuts at the selected month's last day and this window opens the next day, so
  // no movement can feed both amounts.
  it.each([
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 6 },
    { year: 2026, month: 12 },
  ])('holds for $year-$month', ({ year, month }) => {
    const { snapshotDate, window } = resolveCommittedWindow({
      year,
      month,
      todayISO: '2027-06-15',
    })
    expect(snapshotDate < window.start).toBe(true)
  })
})

describe('resolveCommittedWindow — calendar edges', () => {
  it('December rolls the window into the next year', () => {
    expect(resolveCommittedWindow({ year: 2026, month: 12, todayISO: '2026-12-10' })).toEqual({
      window: { start: '2027-01-01', end: '2027-01-31' },
      snapshotDate: '2026-12-10',
      lens: 'live',
      windowElapsed: false,
    })
  })

  it('a January cut lands on the 31st and its window is February', () => {
    const resolved = resolveCommittedWindow({ year: 2026, month: 1, todayISO: '2026-05-04' })
    expect(resolved.snapshotDate).toBe('2026-01-31')
    expect(resolved.window).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('a leap February ends on the 29th', () => {
    const resolved = resolveCommittedWindow({ year: 2028, month: 1, todayISO: '2028-05-04' })
    expect(resolved.window).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})
