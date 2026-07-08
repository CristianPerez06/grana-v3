import { type Tone } from '@grana/transactions'

// `resolveTone` + the `Tone` type are pure and shared via `@grana/transactions`
// (mobile reuses them). Re-exported here so the web components that consume the
// tone matrix keep importing from `./tone` unchanged. `toneToClass` (Tailwind)
// and `fmtAmountParts` (web amount treatment) stay web-only.
export { resolveTone } from '@grana/transactions'
export type { Tone } from '@grana/transactions'

const TONE_CLASS: Record<Tone, string> = {
  income: 'text-income',
  expense: 'text-expense',
  neutral: 'text-neutral-amount',
  pending: 'text-pending',
}

/** Tailwind class for the amount in the given tone. */
export const toneToClass = (tone: Tone): string => TONE_CLASS[tone]

// ── fmtAmountParts ───────────────────────────────────────────────────────────

export type AmountParts = {
  /** Currency symbol (`$` for ARS, `US$` for USD). */
  symbol: string
  /** `+` / `−` / empty string when the tone is neutral or pending. */
  sign: string
  /** Integer part with thousands separator (`1.234.567`). */
  int: string
  /**
   * Decimal part WITHOUT the comma (e.g. `'56'`, `'00'`, or `''` when
   * suppressed). Rendered as superscript by the consumer.
   */
  dec: string
}

/**
 * Format an amount as discrete parts so the consumer can render the currency
 * symbol opaque and the decimals as superscript (v2's TxHero treatment).
 *
 * Decimal suppression: when the amount is integer-cents-exact (`,00`) AND the
 * user opted out of cents (`showCents=false`), the `dec` field is empty so
 * the consumer skips the superscript entirely.
 */
export const fmtAmountParts = (
  amount: number,
  currency: 'ARS' | 'USD',
  tone: Tone,
  showCents: boolean,
): AmountParts => {
  const symbol = currency === 'USD' ? 'US$' : '$'
  const sign = tone === 'income' ? '+' : tone === 'expense' ? '−' : ''
  const abs = Math.abs(amount)
  const fixed = abs.toFixed(2)
  const [intPart = '0', decPart = '00'] = fixed.split('.')
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dec = showCents || decPart !== '00' ? decPart : ''
  return { symbol, sign, int: intFormatted, dec }
}
