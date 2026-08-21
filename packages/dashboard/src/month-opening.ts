// The third amount of "Resumen del mes": what the user was already carrying
// when the month started.
//
// It is DERIVED, not read: `venia = saldoDelMes − (entro − seFue)`. The closing
// balance and the month's flows are already fetched, so no extra round-trip —
// and the identity holds by construction instead of by two reads agreeing:
//
//     venia + entro − seFue === saldoDelMes
//
// which is the whole card auditable on screen: the three amounts of the light
// zone add up to the number in the dark zone above them.
//
// RN-safe: no DOM/Node deps.

import { Money } from '@grana/validation'
import type { MonthSummary } from './month-summary'

/**
 * Opening balance of the month, per currency.
 *
 * @param closingBalance Balance at the month's cut (its last day, or today for
 * the current month) — the number the hero shows for that month.
 * @param summary The month's `entro` / `seFue`.
 */
export function deriveMonthOpening(closingBalance: number, summary: MonthSummary): number {
  const net = Money.subtract(Money.from(summary.entro), Money.from(summary.seFue))
  return Money.toNumber(Money.subtract(Money.from(closingBalance), net))
}
