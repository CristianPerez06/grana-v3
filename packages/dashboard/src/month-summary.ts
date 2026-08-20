// Pure math for the "Resumen del mes" zone of the balance card (web + mobile):
// the two headline flows of the month, per currency.
//
// The zone answers one question — how the money moved in and out of my accounts
// this month — and it answers it as LIQUIDITY, so the two amounts reconcile with
// the month's change in available balance BY CONSTRUCTION:
//
//     entro − seFue === MonthBalanceSeries.finalBalance
//
// which is itself the change in the Disponible over the month. That invariant is
// the point: it makes the card checkable against the balance instead of being
// two numbers nobody can verify.
//
// Money math goes through `Money` rather than raw floats so the invariant holds
// to the cent and the test can assert equality instead of a tolerance.
//
// RN-safe: no DOM/Node deps.

import { Money } from '@grana/validation'
import type { MonthBalanceSeries } from './types'

export type MonthSummary = {
  /**
   * Everything that RAISED the account balances this month: income, received
   * reimbursements, and the positive side of the signed buckets (a settlement
   * in your favour, the destination leg of a currency exchange, a positive
   * adjustment).
   */
  entro: number
  /**
   * Everything that LOWERED them: expenses paid from an account, card statement
   * payments, and the negative side of the signed buckets.
   *
   * Credit-card purchases are absent by construction, not by exclusion: they are
   * off-ledger rows (`status` 'pending'/'paid') and never touch an account
   * balance. What DOES count is paying the statement — that is real money
   * leaving the account.
   */
  seFue: number
}

export type MonthSummaryByCurrency = {
  ARS: MonthSummary
  USD: MonthSummary
}

/**
 * Buckets that carry a sign: they can move the balance either way, so each one
 * lands on the side its sign puts it on.
 *
 * - `totalAdjustment`: a stock correction. It is not "flow" in the accounting
 *   sense, but it DID change the balance, so a liquidity read has to show it or
 *   the two numbers stop reconciling.
 * - `totalSettlement`: settling up with the household, in or out.
 * - `totalExchange`: the leg of a currency exchange that belongs to THIS
 *   currency — never summed across ARS/USD.
 * - `totalTransfer`: the residual of transfers with a single owned leg. Zero in
 *   the normal case (both legs owned), non-zero only when money crossed the
 *   owned-account boundary.
 */
const SIGNED_BUCKETS = [
  'totalAdjustment',
  'totalSettlement',
  'totalExchange',
  'totalTransfer',
] as const

const summarize = (series: MonthBalanceSeries): MonthSummary => {
  let entro = Money.add(Money.from(series.totalIncome), Money.from(series.totalReimbursement))
  let seFue = Money.add(Money.from(series.totalExpense), Money.from(series.totalCardPayment))

  for (const bucket of SIGNED_BUCKETS) {
    const value = series[bucket]
    if (value >= 0) entro = Money.add(entro, Money.from(value))
    else seFue = Money.add(seFue, Money.from(-value))
  }

  return { entro: Money.toNumber(entro), seFue: Money.toNumber(seFue) }
}

/**
 * Derive "Entró" and "Se fue" for both currencies.
 *
 * Every movement that touched an account balance lands on exactly one side, so
 * `entro - seFue` equals the month's `finalBalance` — the change in the
 * available balance — to the cent. ARS and USD are summarized independently and
 * never combined.
 */
export function deriveMonthSummary(series: {
  ARS: MonthBalanceSeries
  USD: MonthBalanceSeries
}): MonthSummaryByCurrency {
  return { ARS: summarize(series.ARS), USD: summarize(series.USD) }
}
