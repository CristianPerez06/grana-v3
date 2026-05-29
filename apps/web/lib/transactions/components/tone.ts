import type { MovementKind } from '@grana/money-logic'

// Editorial amount tone resolution. Lives next to the components that consume
// it (movement-row, tx-hero) so the same matrix drives row and detail in sync.
// Pure: same input → same output. Tested in __tests__/tone.test.ts.

export type Tone = 'income' | 'expense' | 'neutral' | 'pending'

/**
 * Resolve the editorial tone of a movement amount:
 * - `income`: the money is in (income, reimbursement received, ajuste positivo).
 * - `expense`: the money is out (gasto, consumo/cuota tarjeta, pago resumen,
 *   ajuste negativo).
 * - `neutral`: no in/out from the user's net position (transferencia entre
 *   cuentas propias, cambio de moneda).
 * - `pending`: an expected money-in that hasn't landed yet (reintegro con
 *   `received_at IS NULL` y `cancelled_at IS NULL`). Distinct from `income`
 *   so the UI doesn't transmit confidence.
 */
export const resolveTone = (
  kind: MovementKind,
  sign: '+' | '-' | null,
  isPendingReimbursement: boolean,
): Tone => {
  if (isPendingReimbursement) return 'pending'
  if (kind === 'income' || kind === 'reimbursement') return 'income'
  if (kind === 'adjustment') return sign === '-' ? 'expense' : 'income'
  if (kind === 'transfer' || kind === 'exchange') return 'neutral'
  // expense, card_payment, installment_purchase
  return 'expense'
}

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
