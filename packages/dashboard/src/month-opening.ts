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
// `guardado` is the RESERVE STOCK — the whole thing, carried-over months
// included — and it is zero everywhere it does not apply: a past month, or a
// current month with nothing set aside. In those cases the expression collapses
// to the three-term one it always was.
//
// The stock and not the month's flow, because "Tenías" means the ACCOUNT BALANCE
// the month opened with — a number the user can check against their own bank.
// The reasoning is spelled out in `savings-row.ts`, which is also where the term
// comes from; this comment used to say the opposite of what the code does, and
// the caller has always passed `savingsIdentityTerm`, which returns the stock.
//
// The asymmetry to keep in mind when a term is added here: subtract the STOCK
// for anything that leaves money sitting in the accounts (a reserve moves no
// money), and the month's FLOW for anything that takes it out of them. Money
// that left an account in a previous month is already absent from "Tenías", so
// subtracting its stock again would count it twice.
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
