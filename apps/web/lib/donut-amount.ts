// Auto-scales the amount shown in the centre of a donut chart so long totals
// (e.g. "$1.028.737,77") stay inside the ring instead of overlapping it.
//
// The donut hole is ~77% of the SVG size (r=15.915, strokeWidth=4 over a
// 36-unit viewBox). We estimate the formatted string's width at font-size 1px
// using per-glyph factors tuned for the bold tabular-nums numerals used in the
// centre, then pick the largest font-size that fits — capped so short amounts
// keep their original prominence.

const approxWidthAt1px = (s: string): number => {
  let w = 0
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') w += 0.62
    else if (ch === '.' || ch === ',' || ch === ' ') w += 0.3
    else w += 0.58 // currency symbol, mask chars, letters
  }
  return w
}

/**
 * Largest font-size (px) that keeps `formatted` within the donut's inner hole.
 * @param formatted The amount string already formatted for display.
 * @param donutSize The donut's pixel size (width/height).
 * @param maxPx     Upper bound so short amounts don't balloon.
 */
export const donutAmountFontSize = (
  formatted: string,
  donutSize: number,
  maxPx: number,
): number => {
  const usable = donutSize * 0.72 // inner hole (~77%) minus a little padding
  const fitted = usable / approxWidthAt1px(formatted)
  return Math.max(11, Math.min(maxPx, Math.round(fitted)))
}
