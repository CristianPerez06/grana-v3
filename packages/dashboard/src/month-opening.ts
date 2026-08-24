// The third amount of "Resumen del mes": what the user was already carrying
// when the month started.
//
// It is DERIVED, not read: `venia = cierre − (entro − seFue − guardado)`. The
// closing figure and the month's flows are already fetched, so no extra
// round-trip — and the identity holds by construction instead of by two reads
// agreeing:
//
//     venia + entro − seFue − guardado === el número de la zona oscura
//
// which is the whole card auditable on screen: the amounts of the light zone add
// up to the number in the dark zone above them.
//
// `guardado` is the month's NET RESERVE FLOW and it is zero everywhere it does
// not apply — a past month, or a current month with no saving activity. In those
// cases the expression collapses to the three-term one it always was, and the
// same pieces keep doing the same job.
//
// It is the flow, never the accumulated stock: a carried-over reserve is already
// inside "Tenías", which in the current month is the DISPONIBLE the user opened
// with rather than the raw balance. Subtracting the stock here would count it
// twice and the card would report an opening the user never had.
//
// RN-safe: no DOM/Node deps.

import { Money } from '@grana/validation'
import type { MonthSummary } from './month-summary'

/**
 * Opening figure of the month, per currency.
 *
 * @param closingBalance The number the hero shows for that month: the disponible
 * for the current month, the closing balance for a past one.
 * @param summary The month's `entro` / `seFue`.
 * @param savedNet Signed net reserved in the month (saved minus released).
 * Defaults to zero, which is what a past month and a month without saving
 * activity both pass.
 */
export function deriveMonthOpening(
  closingBalance: number,
  summary: MonthSummary,
  savedNet: number = 0,
): number {
  const flows = Money.subtract(Money.from(summary.entro), Money.from(summary.seFue))
  const net = Money.subtract(flows, Money.from(savedNet))
  return Money.toNumber(Money.subtract(Money.from(closingBalance), net))
}
