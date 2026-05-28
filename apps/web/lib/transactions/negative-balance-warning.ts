import { Money } from '@grana/validation'

/**
 * Pure check backing the non-blocking negative-balance warning.
 *
 * Fase 0 decision (see AGENTS.md "Negative balance allowed + soft warning"):
 * a negative `disponible` is allowed and never blocked. This helper only tells
 * the UI whether a given outflow would push a single account's available
 * balance below zero, so the form can *inform* the user before they confirm.
 *
 * Per the spec, the comparison is always against ONE account and ONE currency
 * (the source account of the operation). The caller is responsible for passing
 * the available balance for that account+currency only — never a cross-account
 * total, and never mixing ARS with USD.
 *
 * `currentAvailable` — the account's current `disponible` for the operation's
 *   currency. For edits, pass the available balance that already EXCLUDES the
 *   edited movement's own effect (projected baseline), so a movement does not
 *   "warn against itself".
 * `outflow` — the amount leaving the account (>= 0). For an expense or an
 *   outgoing transfer it is the amount; for a negative adjustment it is the
 *   absolute value of the reduction.
 *
 * Arithmetic goes through `Money` (decimal.js) — never raw JS operators.
 */
export type NegativeBalanceCheck = {
  /** True when the operation leaves the account's available balance below zero. */
  negative: boolean
  /** The resulting available balance after applying the outflow. */
  projected: number
}

export function checkNegativeBalance(
  currentAvailable: number,
  outflow: number,
): NegativeBalanceCheck {
  const safeOutflow = outflow > 0 ? outflow : 0
  const projectedMoney = Money.subtract(Money.from(currentAvailable), Money.from(safeOutflow))
  return {
    negative: safeOutflow > 0 && Money.isNegative(projectedMoney),
    projected: Money.toNumber(projectedMoney),
  }
}
