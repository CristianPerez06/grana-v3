// Shared presentation helpers for the Compartido home sections. Pure and
// client-safe (string parsing + Intl only — no server/date-source imports).

// Category colour fallback — mirrors spending-donut.tsx so shared spending reads
// like the rest of the app when a category has no DB colour.
export const CAT_FALLBACK = [
  'var(--cat-1)',
  'var(--cat-3)',
  'var(--cat-6)',
  'var(--cat-5)',
  'var(--cat-7)',
  'var(--cat-4)',
  'var(--cat-2)',
]

/** "Julio 2026" from a `YYYY-MM`. */
export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Abbreviated month for the projection axis ("jul", "ago"). */
export const monthShort = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
}
