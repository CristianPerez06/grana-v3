import { describe, expect, it } from 'vitest'
import {
  rankFrequentClassifications,
  type FrequentLeafRow,
} from '../src/frequent-classifications'

// Build an expense row with sensible defaults; override per case.
const row = (over: Partial<FrequentLeafRow>): FrequentLeafRow => ({
  type: 'expense',
  categoryId: 'c1',
  subcategoryId: null,
  categoryCanonical: 'c1',
  subcategoryCanonical: null,
  categoryActive: true,
  subcategoryActive: null,
  date: '2026-06-01',
  ...over,
})

// N rows of the same leaf.
const times = (n: number, over: Partial<FrequentLeafRow>): FrequentLeafRow[] =>
  Array.from({ length: n }, () => row(over))

describe('rankFrequentClassifications', () => {
  it('ranks leaves by count, most used first', () => {
    const rows = [
      ...times(3, { categoryId: 'regalos' }),
      ...times(1, { categoryId: 'comida', subcategoryId: 'rappi', subcategoryCanonical: 'rappi' }),
    ]
    const out = rankFrequentClassifications(rows)
    expect(out.map((c) => c.categoryId)).toEqual(['regalos', 'comida'])
  })

  it('groups by leaf (category + subcategory), not by category', () => {
    // Comida used a lot, but split across two subcategories; Regalos is one leaf.
    const rows = [
      ...times(2, { categoryId: 'comida', subcategoryId: 'rappi', subcategoryCanonical: 'rappi' }),
      ...times(2, { categoryId: 'comida', subcategoryId: 'super', subcategoryCanonical: 'super' }),
      ...times(3, { categoryId: 'regalos' }),
    ]
    const out = rankFrequentClassifications(rows)
    // Regalos (3) beats each Comida leaf (2), even though Comida totals 4.
    expect(out[0]).toEqual({ categoryId: 'regalos', subcategoryId: null })
  })

  it('breaks ties by most recent use', () => {
    const rows = [
      row({ categoryId: 'a', date: '2026-06-01' }),
      row({ categoryId: 'b', date: '2026-06-20' }),
    ]
    expect(rankFrequentClassifications(rows).map((c) => c.categoryId)).toEqual(['b', 'a'])
  })

  it('excludes impuesto-de-sellos BEFORE ranking so the slot fills with a real one', () => {
    const rows = [
      ...times(10, {
        categoryId: 'impuestos',
        subcategoryId: 'sellos',
        subcategoryCanonical: 'impuesto-de-sellos',
      }),
      ...times(2, { categoryId: 'regalos' }),
    ]
    const out = rankFrequentClassifications(rows, 4)
    expect(out.map((c) => c.categoryId)).toEqual(['regalos'])
    expect(out).toHaveLength(1)
  })

  it('drops archived leaves', () => {
    const rows = [
      ...times(3, { categoryId: 'archivada', categoryActive: false }),
      ...times(1, {
        categoryId: 'comida',
        subcategoryId: 'vieja',
        subcategoryCanonical: 'vieja',
        subcategoryActive: false,
      }),
      ...times(1, { categoryId: 'regalos' }),
    ]
    expect(rankFrequentClassifications(rows).map((c) => c.categoryId)).toEqual(['regalos'])
  })

  it('caps at the per-type limit and returns expense then income', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row({ categoryId: `e${i}` })),
      ...Array.from({ length: 6 }, (_, i) => row({ type: 'income', categoryId: `i${i}` })),
    ]
    const out = rankFrequentClassifications(rows, 4)
    expect(out).toHaveLength(8)
    expect(out.slice(0, 4).every((c) => c.categoryId.startsWith('e'))).toBe(true)
    expect(out.slice(4).every((c) => c.categoryId.startsWith('i'))).toBe(true)
  })
})
