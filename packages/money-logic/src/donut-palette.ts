// Colour helpers for the "En qué se fue" donut, shared by the web card and the
// native one so both platforms paint the same breakdown the same way.
//
// These are pure functions over colour strings — no React, no DOM. They live
// here next to `buildCategorySlices` (which already carries `OTHERS_COLOR`)
// because the alternative was a hand-synced copy in `apps/mobile`, which
// `repo-architecture` forbids.

/** Neutral grey for a slice with no category colour, and for "Otros". */
export const DONUT_FALLBACK = '#9CA3AF'

/**
 * Egresos keeps each category's own DB colour (multicolour by design); Ingresos
 * uses this fixed green palette assigned by RANKING POSITION, so income
 * categories read as a single tonal family even when they have no colour set.
 */
export const INCOME_PALETTE = ['#0E9E6E', '#16B981', '#4FC79A', '#86D9B8'] as const

/** Accent for the eyebrow title, the donut centre label and the active tab. */
export const MODE_ACCENT: Record<'egresos' | 'ingresos', string> = {
  egresos: '#0B1A2B',
  ingresos: '#0E9E6E',
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 50 }
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/**
 * Generates N tints that stay in the parent colour's family but separate on two
 * axes so neighbouring slices read distinctly even when their shares are nearly
 * equal: a wide lightness ramp (76% lightest → 30% darkest) plus a small
 * analogous hue sweep centred on the parent (±span°). Saturation is clamped to a
 * readable band so bright hues don't blow out and muddy ones don't wash out.
 *
 * Emits the COMMA form `hsl(h, s%, l%)` rather than the space-separated CSS
 * Color 4 form: React Native's colour parser only handles the comma form
 * reliably, and both platforms have to read the same string.
 */
export function generateSubTints(parentColor: string, n: number): string[] {
  if (n === 0) return []
  const { h, s } = hexToHSL(parentColor)
  const sc = Math.min(Math.max(s, 48), 66)
  if (n === 1) return [`hsl(${h}, ${sc}%, 52%)`]
  // Wider arc as the slice count grows, capped so we stay analogous (in family).
  const span = Math.min(14 + n * 5, 54)
  return Array.from({ length: n }, (_, j) => {
    const t = j / (n - 1) // 0 (largest slice) → 1 (smallest)
    const hue = Math.round((h - span / 2 + span * t + 360) % 360)
    const l = Math.round(76 - (76 - 30) * t)
    return `hsl(${hue}, ${sc}%, ${l}%)`
  })
}
