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

/**
 * What made up "Entró", by CONCEPT — not by where the money landed.
 *
 * The three add up to `entro` by construction: they are the same terms
 * `summarize` already sums, handed out instead of thrown away. A card that
 * opens this can promise its rows reconcile with the total above them.
 */
export type EntroParts = {
  /** `type='income'` credited to an owned account — salary, interest, anything earned. */
  ingresos: number
  /** Received "a cuenta" reimbursements: money that came BACK, not money earned. */
  devoluciones: number
  /**
   * Positive side of the signed buckets: a settlement in your favour, the
   * destination leg of a currency exchange, a positive adjustment. Zero in the
   * ordinary month, which is why the UI drops the row when it is.
   */
  otros: number
}

/** What made up "Se fue", by concept. The three add up to `seFue`. */
export type SeFueParts = {
  /** Real spending paid from an account (`type='expense'`, not a statement payment). */
  gastos: number
  /** Card statement payments: they cancel debt already accrued, they are not new spending. */
  pagosDeTarjeta: number
  /** Negative side of the signed buckets. Zero in the ordinary month. */
  otros: number
}

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
  /** The concepts behind `entro`. Sums to it. */
  entroParts: EntroParts
  /** The concepts behind `seFue`. Sums to it. */
  seFueParts: SeFueParts
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
  // The signed buckets are the only term that can land on either side, so they
  // are the only one accumulated in a loop. Everything else is a fixed concept.
  let entroOtros = Money.from(0)
  let seFueOtros = Money.from(0)
  for (const bucket of SIGNED_BUCKETS) {
    const value = series[bucket]
    if (value >= 0) entroOtros = Money.add(entroOtros, Money.from(value))
    else seFueOtros = Money.add(seFueOtros, Money.from(-value))
  }

  const entroParts: EntroParts = {
    ingresos: series.totalIncome,
    devoluciones: series.totalReimbursement,
    otros: Money.toNumber(entroOtros),
  }
  const seFueParts: SeFueParts = {
    gastos: series.totalExpense,
    pagosDeTarjeta: series.totalCardPayment,
    otros: Money.toNumber(seFueOtros),
  }

  // The totals are the sum of their own parts, not a parallel calculation: two
  // ways of reaching the same number is how a card starts disagreeing with the
  // rows it just opened.
  const sum = (parts: Record<string, number>) =>
    Money.toNumber(
      Object.values(parts).reduce((acc, value) => Money.add(acc, Money.from(value)), Money.from(0)),
    )

  return {
    entro: sum(entroParts),
    seFue: sum(seFueParts),
    entroParts,
    seFueParts,
  }
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
