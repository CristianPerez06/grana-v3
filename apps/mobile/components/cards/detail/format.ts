// Shared bits for the native card-detail components. Token hexes are needed
// where a value goes into an inline `style` (dots, rings, progress fills) that
// NativeWind classes can't express; keep in sync with @grana/ui-tokens.

export const detailColors = {
  terracotta: '#B56A5A',
  emerald: '#10B981',
  textMuted: '#6B7683',
  textSoft: '#8A94A3',
  border: '#E6EAEF',
} as const

/**
 * The shared i18n catalog carries `<b>…</b>` emphasis for web (next-intl
 * `t.rich`). Mobile renders plain text, so strip the tags — the copy is
 * identical, just without the bold run.
 */
export const stripBold = (s: string): string => s.replace(/<\/?b>/g, '')
