import { describe, expect, it } from 'vitest'
import {
  buildCategorySlices,
  buildSliceMetaLine,
  generateSubTints,
  groupForDonut,
  NO_OTHERS_CAP,
  type CategorySliceInput,
  type SliceMetaTemplates,
} from '@grana/money-logic'

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

describe('buildSliceMetaLine', () => {
  const templates: SliceMetaTemplates = {
    installments: (desc, share) => `${share}% · cuotas ${desc}`,
    recurring: (n, share) => `${share}% · ${n} recurrentes`,
    movements: (n, share) => `${share}% · ${n} movimientos`,
  }

  it('falls back to movement count when no enriched context', () => {
    const line = buildSliceMetaLine({ percentage: 40 }, { movementCount: 8 }, templates)
    expect(line).toBe('40% · 8 movimientos')
  })

  it('prefers installments when a dominant description is present', () => {
    const line = buildSliceMetaLine(
      { percentage: 25 },
      { movementCount: 1, dominantInstallmentDescription: 'Sofá Sofías' },
      templates,
    )
    expect(line).toBe('25% · cuotas Sofá Sofías')
  })

  it('prefers recurring count when no installments and recurringCount > 0', () => {
    const line = buildSliceMetaLine(
      { percentage: 11 },
      { movementCount: 3, recurringCount: 3 },
      templates,
    )
    expect(line).toBe('11% · 3 recurrentes')
  })

  it('treats empty/whitespace installment description as absent', () => {
    const line = buildSliceMetaLine(
      { percentage: 15 },
      { movementCount: 14, dominantInstallmentDescription: '   ', recurringCount: 0 },
      templates,
    )
    expect(line).toBe('15% · 14 movimientos')
  })

  it('rounds the percentage for display', () => {
    const line = buildSliceMetaLine({ percentage: 24.6 }, { movementCount: 5 }, templates)
    expect(line).toBe('25% · 5 movimientos')
  })
})

// ── groupForDonut ─────────────────────────────────────────────────────────────
// The ranking needs EVERY category, the donut needs a legible top-N. Consumers
// build uncapped and regroup here, so this must reproduce `buildCategorySlices`'
// tail logic exactly — otherwise the donut and the ranking disagree on "Otros".

describe('groupForDonut', () => {
  const uncapped = (...values: number[]) =>
    buildCategorySlices(
      values.map((v, i) => cat(String.fromCharCode(97 + i), v)),
      { topN: NO_OTHERS_CAP, othersLabel: 'Otros' },
    )

  it('leaves a breakdown at or under topN untouched', () => {
    const b = uncapped(50, 30, 20)
    expect(groupForDonut(b, 6, 'Otros')).toBe(b)
  })

  it('folds the tail beyond topN into one "Otros" slice', () => {
    const b = uncapped(40, 30, 20, 6, 4)
    const { slices } = groupForDonut(b, 3, 'Otros')
    expect(slices).toHaveLength(4)
    expect(slices[3].categoryId).toBeNull()
    expect(slices[3].label).toBe('Otros')
    expect(slices[3].value).toBe(10)
    expect(slices[3].percentage).toBeCloseTo(10)
  })

  it('keeps the arcs contiguous: "Otros" starts where the last named slice ends', () => {
    const b = uncapped(40, 30, 20, 6, 4)
    const { slices } = groupForDonut(b, 3, 'Otros')
    const last = slices[2]
    expect(slices[3].offset).toBeCloseTo(last.offset + last.percentage)
    expect(slices[3].offset + slices[3].percentage).toBeCloseTo(100)
  })

  it('matches what buildCategorySlices would have produced with the same cap', () => {
    const values = [40, 30, 20, 6, 4]
    const capped = buildCategorySlices(
      values.map((v, i) => cat(String.fromCharCode(97 + i), v)),
      { topN: 3, othersLabel: 'Otros' },
    )
    const regrouped = groupForDonut(uncapped(...values), 3, 'Otros')
    expect(regrouped.total).toBe(capped.total)
    expect(regrouped.slices.map((s) => [s.categoryId, s.value])).toEqual(
      capped.slices.map((s) => [s.categoryId, s.value]),
    )
  })

  it('preserves the total (it regroups, it does not recompute)', () => {
    const b = uncapped(40, 30, 20, 6, 4)
    expect(groupForDonut(b, 2, 'Otros').total).toBe(b.total)
  })
})

// ── generateSubTints ──────────────────────────────────────────────────────────
// Native and web read the same string, and React Native's colour parser only
// handles the COMMA form of hsl() reliably — so the format is load-bearing.

describe('generateSubTints', () => {
  it('emits the comma form of hsl() so React Native can parse it', () => {
    for (const tint of generateSubTints('#D95F3D', 4)) {
      expect(tint).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    }
  })

  it('returns one tint per slice, and nothing for zero slices', () => {
    expect(generateSubTints('#D95F3D', 0)).toEqual([])
    expect(generateSubTints('#D95F3D', 1)).toHaveLength(1)
    expect(generateSubTints('#D95F3D', 8)).toHaveLength(8)
  })

  it('ramps lightness from lightest to darkest so neighbours read apart', () => {
    const light = (t: string) => Number(/(\d+)%\)$/.exec(t)![1])
    const tints = generateSubTints('#D95F3D', 5)
    for (let i = 1; i < tints.length; i++) {
      expect(light(tints[i])).toBeLessThan(light(tints[i - 1]))
    }
  })

  it('falls back to a neutral hue on an unparseable colour', () => {
    expect(generateSubTints('not-a-color', 1)[0]).toMatch(/^hsl\(0, /)
  })
})
