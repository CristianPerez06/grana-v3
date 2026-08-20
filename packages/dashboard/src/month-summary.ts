// Pure math for the "Resumen del mes" zone of the balance card (web + mobile):
// the two headline flows of the month, per currency.
//
// The zone answers one question — what came in and what went out of my accounts
// this month — with two amounts and nothing else. The full per-bucket breakdown
// (adjustments, settlements, currency exchange) lives in Movimientos; folding
// those buckets into the two headlines here would make the numbers stop matching
// what the user reads as "entró" and "se fue".
//
// RN-safe: no DOM/Node deps.

import type { MonthBalanceSeries } from './types'

export type MonthSummary = {
  /**
   * Money that credited the accounts this month: income plus received
   * reimbursements. A reimbursement is cash coming back in — for the CAJA lens
   * it behaves like income, and leaving it out would make the summary disagree
   * with the change in the available balance.
   */
  entro: number
  /**
   * Money that left the accounts this month: real expense plus card statement
   * payments. The statement payment is NOT new spending (it cancels debt already
   * accrued in an earlier month) but it IS a real outflow, so it belongs here
   * even though it stays out of "Gastaste".
   */
  seFue: number
}

export type MonthSummaryByCurrency = {
  ARS: MonthSummary
  USD: MonthSummary
}

const summarize = (series: MonthBalanceSeries): MonthSummary => ({
  entro: series.totalIncome + series.totalReimbursement,
  seFue: series.totalExpense + series.totalCardPayment,
})

/**
 * Derive "Entró" and "Se fué" for both currencies.
 *
 * The two are NOT the two halves of the month's net: signed buckets
 * (adjustments, settlements, currency exchange, cross-boundary transfers) also
 * move the balance and are deliberately excluded, so `entro - seFue` does not
 * have to equal `finalBalance`. That is the point — these are the two flows the
 * user recognizes, not a reconciliation.
 */
export function deriveMonthSummary(series: {
  ARS: MonthBalanceSeries
  USD: MonthBalanceSeries
}): MonthSummaryByCurrency {
  return { ARS: summarize(series.ARS), USD: summarize(series.USD) }
}
