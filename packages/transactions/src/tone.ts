import type { MovementKind } from '@grana/money-logic'

// Editorial amount tone resolution. Pure (kind + sign → tone), shared so web
// and mobile derive the same tone; each platform maps `Tone` to its own style
// system (web → Tailwind class via `toneToClass`; mobile → structural token).

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
