import { describe, expect, it } from 'vitest'
import { computeConcentration } from '../concentration'

describe('computeConcentration', () => {
  it('derives the dominant share and proportional segments', () => {
    const c = computeConcentration([
      { id: 'a', ars: 9_575_790.25 },
      { id: 'b', ars: 146_939.17 },
      { id: 'c', ars: 108_200 },
      { id: 'd', ars: 53_082.99 },
    ])

    expect(c.dominantId).toBe('a')
    expect(c.dominantPct).toBe(97)
    expect(c.segments).toHaveLength(4)
    // Segments sum to ~100 and the dominant one matches its raw share.
    const sum = c.segments.reduce((s, seg) => s + seg.pct, 0)
    expect(sum).toBeCloseTo(100, 5)
    expect(c.segments[0]).toMatchObject({ id: 'a' })
    expect(c.segments[0].pct).toBeCloseTo((9_575_790.25 / c.totalArs) * 100, 5)
  })

  it('reports 100% for a single funded account', () => {
    const c = computeConcentration([{ id: 'only', ars: 50_000 }])
    expect(c.dominantId).toBe('only')
    expect(c.dominantPct).toBe(100)
    expect(c.segments).toEqual([{ id: 'only', pct: 100 }])
  })

  it('returns no callout when there is no positive ARS balance', () => {
    const c = computeConcentration([
      { id: 'a', ars: 0 },
      { id: 'b', ars: 0 },
    ])
    expect(c.totalArs).toBe(0)
    expect(c.dominantId).toBeNull()
    expect(c.dominantPct).toBeNull()
    expect(c.segments).toEqual([])
  })

  it('ignores negative (overdraft) balances in the bar', () => {
    const c = computeConcentration([
      { id: 'a', ars: 100_000 },
      { id: 'b', ars: -20_000 },
    ])
    expect(c.totalArs).toBe(100_000)
    expect(c.dominantId).toBe('a')
    expect(c.dominantPct).toBe(100)
    expect(c.segments).toEqual([{ id: 'a', pct: 100 }])
  })
})
