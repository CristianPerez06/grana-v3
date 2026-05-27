import { describe, expect, it } from 'vitest'
import { buildCategorySlices, type CategorySliceInput } from '@grana/money-logic'

const cat = (id: string, value: number): CategorySliceInput => ({
  categoryId: id,
  label: id,
  color: '#000',
  icon: '🍔',
  value,
})

describe('buildCategorySlices', () => {
  it('sorts by value desc and computes percentages summing to 100', () => {
    const { total, slices } = buildCategorySlices([cat('a', 20), cat('b', 80)])
    expect(total).toBe(100)
    expect(slices.map((s) => s.label)).toEqual(['b', 'a'])
    expect(slices[0].percentage).toBe(80)
    expect(slices[1].percentage).toBe(20)
    expect(slices.reduce((acc, s) => acc + s.percentage, 0)).toBeCloseTo(100, 6)
  })

  it('accumulates offset for contiguous donut arcs', () => {
    const { slices } = buildCategorySlices([cat('a', 50), cat('b', 30), cat('c', 20)])
    expect(slices[0].offset).toBe(0)
    expect(slices[1].offset).toBeCloseTo(50, 6)
    expect(slices[2].offset).toBeCloseTo(80, 6)
  })

  it('groups the tail beyond topN into "Otros"', () => {
    const inputs = [cat('a', 50), cat('b', 25), cat('c', 15), cat('d', 6), cat('e', 4)]
    const { slices } = buildCategorySlices(inputs, { topN: 2, othersLabel: 'Otros' })
    expect(slices).toHaveLength(3) // a, b, Otros
    const others = slices[2]
    expect(others.categoryId).toBeNull()
    expect(others.label).toBe('Otros')
    expect(others.value).toBe(25) // 15 + 6 + 4
  })

  it('ignores non-positive values (e.g. fully reimbursed categories)', () => {
    const { total, slices } = buildCategorySlices([cat('a', 100), cat('b', 0), cat('c', -10)])
    expect(total).toBe(100)
    expect(slices).toHaveLength(1)
    expect(slices[0].label).toBe('a')
  })

  it('handles an empty / all-zero breakdown', () => {
    expect(buildCategorySlices([])).toEqual({ total: 0, slices: [] })
    expect(buildCategorySlices([cat('a', 0)])).toEqual({ total: 0, slices: [] })
  })

  it('a single category is the whole donut', () => {
    const { slices } = buildCategorySlices([cat('a', 100)])
    expect(slices).toHaveLength(1)
    expect(slices[0].percentage).toBe(100)
    expect(slices[0].offset).toBe(0)
  })
})
