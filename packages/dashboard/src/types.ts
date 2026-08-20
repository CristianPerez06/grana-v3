import type { ResolvedAccountAvatar } from '@grana/ui-contracts'

export type HeroAccountBalance = {
  id: string
  /** User-given account name (e.g. "Caja de ahorro sueldo"). */
  name: string
  /** Bank/institution display name when the account has one; null for cash. */
  institutionName: string | null
  ars: number
  usd: number
  avatar: ResolvedAccountAvatar
}

export type DashboardHero = {
  ars: number
  usd: number
  /**
   * Per-account breakdown (cash/bank only), ordered by ARS balance desc.
   * Feeds the "Dónde está" card on both platforms.
   */
  accounts: HeroAccountBalance[]
}

export type MonthBalanceDay = {
  day: number
  accumulatedBalance: number
  dailyIncome: number
  dailyExpense: number
  /**
   * Net balance adjustments of the day, signed (positive raises the balance,
   * negative lowers it). Kept in its own bucket so it feeds the accumulated
   * balance without contaminating dailyIncome/dailyExpense.
   */
  dailyAdjustment: number
}

export type MonthBalanceSeries = {
  year: number
  month: number
  days: MonthBalanceDay[]
  totalIncome: number
  /** Real expense only (`type='expense'` that is NOT a card statement payment). */
  totalExpense: number
  /**
   * Net of `type='adjustment'` movements for the month, signed. Adjustments
   * are stock corrections, not flow: they stay out of totalIncome/totalExpense
   * (so those reflect real flow and "Gastos" reconciles with "En qué se fue")
   * but still affect finalBalance.
   */
  totalAdjustment: number
  /**
   * Card statement payments of the month (the `expense` on cash/bank linked to
   * a `period_payments`). Kept out of `totalExpense` (it cancels already-accrued
   * debt, it is not new spending) but it IS a real cash outflow, so it lowers
   * `finalBalance`.
   */
  totalCardPayment: number
  /** Received "a cuenta" reimbursements (credit the account, like income). */
  totalReimbursement: number
  /** Net of debt settlements, signed: `in` adds, `out` subtracts. */
  totalSettlement: number
  /**
   * Net of currency-exchange legs for THIS currency, signed: the source leg
   * (money leaving this currency) subtracts, the destination leg (money arriving
   * in this currency) adds. Reconciles per-currency, never summed across ARS/USD.
   */
  totalExchange: number
  /**
   * Residual of transfers with only ONE owned leg, signed: money leaving the
   * owned universe subtracts, money arriving adds. **Zero whenever both legs are
   * owned accounts** — the normal case — which is why the UI renders no row for
   * it. It exists so `finalBalance` keeps reconciling with the Disponible when a
   * transfer touches an account outside the owned universe (e.g. an archived
   * one), instead of the series silently netting it to zero.
   */
  totalTransfer: number
  /**
   * Net of the month, reconciling with the change in `disponible` by
   * construction (same per-type sign rules as `calculateTransactionSums`):
   * finalBalance = totalIncome − totalExpense − totalCardPayment
   *   + totalAdjustment + totalReimbursement + totalSettlement + totalExchange
   *   + totalTransfer.
   */
  finalBalance: number
}

/** One listed movement in a committed section (top-by-amount detail). */
export type CommittedItem = {
  /** Movement description (consumo merchant / recurrence label). */
  description: string
  /** ISO date: card tx `date` or recurrence instance `scheduled_date`. */
  date: string
  /** Positive amount in the section's currency. */
  amount: number
}

/**
 * COMPROMISO lens ("¿cuánta plata ya se sabe que hay que pagar el mes que
 * viene?"), per currency. The window is the NEXT CALENDAR MONTH, day 1 to last
 * day — the card is titled by that month and the numbers are that month's.
 *
 * The committed total = `debt + recurringExpense` within a currency.
 * `recurringIncome` is context for the "Ya entra" band, never summed, and
 * `overdue` is money already late — carried apart, never inside the total.
 * ARS and USD are never combined.
 */
export type CommittedCurrency = {
  /**
   * Cards: pending consumos − received reimbursements across the unpaid
   * statements whose DUE DATE falls inside the window. The criterion is the due
   * date, not the close date — a statement closing 28/09 but due 10/10 is paid
   * in October. A statement that has not closed yet contributes what it has
   * accrued so far and can still grow before it closes.
   */
  debt: number
  /**
   * Unpaid statements whose due date ALREADY PASSED (`due_date < today`).
   * DISJOINT from `debt`: what is late and what is merely coming are two
   * different facts, and the UI labels this one as overdue instead of blurring
   * it into the next month's amount. 0 when nothing is overdue.
   */
  overdue: number
  /**
   * Gastos fijos: recurrence occurrences falling inside the window that are NOT
   * paid by a credit card — those land in that card's statement and are paid
   * when it comes due, so counting them here too would count them twice. Both
   * sources feed it: instances the generator already created for the window and
   * still unresolved, plus the projected occurrences of the active rules (the
   * projection advances from `last_generated_date`, so the two never overlap).
   */
  recurringExpense: number
  /** Active `income` recurrences projected into the window (context for "Ya entra", never summed). */
  recurringIncome: number
  /**
   * `debt` grouped BY CARD, by amount desc — one row per card, which is the
   * question the user asks ("cuánto me viene de Visa"). The rows add up to
   * `debt`: overdue money is NOT in here, it has its own line.
   */
  cards: CommittedCardRow[]
  /** The window's fixed expenses, by amount desc (section detail). */
  topRecurring: CommittedItem[]
}

/**
 * One CARD's committed total for the outlook, with its next statement close.
 *
 * Different from `CommittedItem`, which is a single consumo: the redesigned
 * "Compromisos" card groups the debt BY CARD ("cuánto me viene de Visa"), which
 * is the question the user actually asks, so a card with twenty consumos is one
 * row, not twenty.
 */
export type CommittedCardRow = {
  /** Credit account id. */
  id: string
  /** Display name: the institution when the card has one, else the account name. */
  label: string
  /** Committed amount for this card in the section's currency. */
  amount: number
  /** ISO date of the next statement close, or null when none is upcoming. */
  nextClose: string | null
}

export type CommittedOutlook = {
  ARS: CommittedCurrency
  USD: CommittedCurrency
}

/**
 * Per-currency month balance. ARS and USD are never summed (bimoneda): the
 * dashboard shows the ARS totals as the headline and the USD totals in a
 * subordinate strip. The daily series stays available for future temporal
 * views (the accumulated line chart was retired by the dashboard redesign).
 */
export type MonthBalanceByCurrency = {
  year: number
  month: number
  ARS: MonthBalanceSeries
  USD: MonthBalanceSeries
}
