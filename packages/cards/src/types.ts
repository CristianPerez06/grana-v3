import type { PeriodVariant } from '@grana/money-logic'
import type { CardPeriodWithPayment } from '@grana/transactions-mutations'

// Canonical homes: the period status/variant unions live in `@grana/money-logic`
// and the full period-with-payment row in `@grana/transactions-mutations`. We
// re-export them here so the cards read slice (and `apps/web/lib/cards/*`, which
// re-exports from this package) has a single source of truth.
export type { PeriodVariant, CardPeriodWithPayment }

/** Due-date proximity flag for an unpaid period, used by the card list/detail. */
export type CardPeriodAlert = 'red' | 'amber' | 'none'

/**
 * Per-card summary for the wallet list and for the `credit` group embedded in
 * the accounts catalog (`@grana/accounts` `getAccounts`).
 */
export type CreditCardSummary = {
  id: string
  name: string
  type: 'credit'
  is_active: boolean
  credit_limit: number | null
  network_id: string | null
  other_network_name: string | null
  institution_id: string | null
  /** Institution branding + name for the card accent and bank grouping. */
  institution: { name: string | null; brand_color: string | null; icon_type: string | null } | null
  color_key: string | null
  icon_key: string | null
  created_at: string
  currencies: Array<{ currency_code: string; is_active: boolean }>
  /** Count of active installment purchases (parents with ≥1 pending child). */
  activeInstallmentsCount: number
  /**
   * Whether the card is "in use" this cycle: its active period has pending
   * charges OR it has active installment purchases. Drives the per-bank
   * "M en uso" group counter and the "En uso" filter in the compact list.
   */
  inUse: boolean
  activePeriod: (CardPeriodWithPayment & {
    pendingAmountARS: number
    pendingAmountUSD: number
    variant: PeriodVariant
    alert: CardPeriodAlert
  }) | null
  /**
   * The current OPEN statement (`start_date <= today <= end_date`, unpaid) with
   * its pending amounts and close date — the "en curso" statement, distinct from
   * `activePeriod` (which, for a card that has a closed-unpaid statement, is the
   * one "a pagar", not the open one). `null` when the card has no open period.
   * Feeds the hero's "En curso" figure and "Próximos cierres".
   */
  inProgress: { endDate: string; amountARS: number; amountUSD: number } | null
}

/** Debt guard for the account archive/delete affordance. */
export type CreditCardDebtCheck =
  | { hasPendingDebt: false }
  | { hasPendingDebt: true; reason: 'pending_debt' }
