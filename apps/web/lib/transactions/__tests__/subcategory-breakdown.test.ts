import { describe, expect, it } from 'vitest'
import {
  buildSubcategorySlices,
  type SubcategorySliceInput,
} from '@grana/money-logic'

const sub = (id: string | null, value: number, label?: string): SubcategorySliceInput => ({
  subcategoryId: id,
  label: label ?? id ?? 'sin-subcat',
  color: '#B56A5A',
  icon: null,
  value,
})

describe('buildSubcategorySlices', () => {
  it('sorts by value desc and computes percentages summing to 100', () => {
    const { total, slices } = buildSubcategorySlices([sub('a', 30), sub('b', 70)])
    expect(total).toBe(100)
    expect(slices.map((s) => s.label)).toEqual(['b', 'a'])
    expect(slices[0].percentage).toBe(70)
    expect(slices[1].percentage).toBe(30)
    expect(slices.reduce((acc, s) => acc + s.percentage, 0)).toBeCloseTo(100, 6)
  })

  it('accumulates offset for contiguous donut arcs', () => {
    const { slices } = buildSubcategorySlices([sub('a', 60), sub('b', 30), sub('c', 10)])
    expect(slices[0].offset).toBe(0)
    expect(slices[1].offset).toBeCloseTo(60, 6)
    expect(slices[2].offset).toBeCloseTo(90, 6)
  })

  it('includes the "Sin subcategoría" bucket as a normal slice when value > 0', () => {
    const { slices } = buildSubcategorySlices([
      sub('a', 50, 'Almuerzo'),
      sub(null, 30, 'Sin subcategoría'),
      sub('b', 20, 'Desayuno'),
    ])
    expect(slices).toHaveLength(3)
    const noneSlice = slices.find((s) => s.subcategoryId === null && s.label === 'Sin subcategoría')
    expect(noneSlice).toBeDefined()
    expect(noneSlice?.percentage).toBe(30)
  })

  it('returns every positive slice sorted (no "Otros" lumping — host collapses visually)', () => {
    const inputs = [
      sub('a', 50),
      sub('b', 25),
      sub('c', 15),
      sub('d', 6),
      sub('e', 4),
    ]
    const { slices } = buildSubcategorySlices(inputs)
    expect(slices).toHaveLength(5)
    expect(slices.map((s) => s.subcategoryId)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(slices.map((s) => s.value)).toEqual([50, 25, 15, 6, 4])
  })

  it('ignores non-positive values', () => {
    const { total, slices } = buildSubcategorySlices([
      sub('a', 100),
      sub('b', 0),
      sub(null, -10),
    ])
    expect(total).toBe(100)
    expect(slices).toHaveLength(1)
    expect(slices[0].label).toBe('a')
  })

  it('handles an empty / all-zero breakdown', () => {
    expect(buildSubcategorySlices([])).toEqual({ total: 0, slices: [] })
    expect(buildSubcategorySlices([sub('a', 0)])).toEqual({ total: 0, slices: [] })
  })

  it('a single subcategory is the whole donut', () => {
    const { slices } = buildSubcategorySlices([sub('a', 200)])
    expect(slices).toHaveLength(1)
    expect(slices[0].percentage).toBe(100)
    expect(slices[0].offset).toBe(0)
  })

  it('all value in the "Sin subcategoría" bucket', () => {
    const { total, slices } = buildSubcategorySlices([sub(null, 80, 'Sin subcategoría')])
    expect(total).toBe(80)
    expect(slices).toHaveLength(1)
    expect(slices[0].subcategoryId).toBeNull()
    expect(slices[0].percentage).toBe(100)
  })
})
