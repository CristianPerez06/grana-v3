/**
 * Pure presentation helpers shared by the account drawer forms (create + edit).
 * Kept framework-free so both forms derive the live-preview accent identically.
 */

/** Strip a leading "Banco " so names read "Galicia", not "Banco Galicia". */
export const shortBankName = (name: string): string => name.replace(/^banco\s+/i, '').trim()

/** Accent colour for the preview: cash = terracotta; bank = brand colour (or slate). */
export const accountAccent = (type: 'cash' | 'bank', brandColor: string | null): string =>
  type === 'bank' ? brandColor ?? 'var(--account-slate)' : 'var(--terracotta)'

/** rgba(...,0.12) soft tint from a #hex (3- or 6-digit). Falls back to the input. */
export const softFromHex = (hex: string): string => {
  const h = hex.replace('#', '')
  if (h.length !== 3 && h.length !== 6) return hex
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return hex
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.12)`
}
