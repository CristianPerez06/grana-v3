import { catPalette } from '../../lib/colors'

// Shared card surface for the Hogar module: bordered + subtle shadow, matching
// the `Card` primitive (rounded-xl border border-border bg-card shadow-sm) and
// the design mock's `.card`. Kept as a constant so every Hogar surface reads
// with the same elevation instead of a flat fill.
export const CARD = 'rounded-2xl border border-border bg-card shadow-sm'

// Fallback tile colors for categories with no stored color (data-driven colors
// come from `categoryColor`). Reuses the shared category palette mirror.
export const CAT_FALLBACK = catPalette
