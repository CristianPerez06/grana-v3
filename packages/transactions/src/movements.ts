import type { MovementViewInput } from '@grana/money-logic'
import type { ReimbursementTarget } from './types'

// The display-VM layer over a transaction row: the `FinancialMovement`
// discriminated union that a movement row renders, plus the pure bridge to
// `resolveMovementView` of `@grana/money-logic`. Shared so both web (the
// `/transactions` feed, the account detail) and mobile (the card statement
// movements pane) render the same shape. The DB→movement mappers of the global
// feed (`toFinancialMovement`, `toInitialBalanceMovement`) stay in web and
// import this type; the card-specific mapper lives in `@grana/cards`.

export type MovementReviewFlag = 'missing_category'

type BaseMovement = {
  id: string
  date: string
  created_at: string
  amount: number
  currency_code: 'ARS' | 'USD'
  description: string | null
  account_id: string | null
  account_name: string | null
  /** Owning institution name (bank/credit) — the row headline, name goes secondary. */
  account_institution_name: string | null
  /** Category id/name/emoji/color for filtering, the row icon and subtitle (null when not categorized). */
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  /** Translation handles: system categories (is_system) render `categories.{canonical_name}` instead of the raw name. */
  category_canonical_name: string | null
  category_is_system: boolean
  /** Subcategory id/name for the row subtitle (null when not assigned or not applicable). */
  subcategory_id: string | null
  subcategory_name: string | null
  subcategory_canonical_name: string | null
  subcategory_is_system: boolean
  detail_href: string | null
  review_flags: MovementReviewFlag[]
  /** Part of a shared household expense — drives the "Compartido" row marker. */
  isShared: boolean
}

export type IncomeMovement = BaseMovement & {
  kind: 'income'
  title: string
  sign: '+'
}

export type ExpenseMovement = BaseMovement & {
  kind: 'expense'
  title: string
  sign: '-'
}

export type CardPaymentMovement = BaseMovement & {
  kind: 'card_payment'
  title: 'Pago de resumen'
  sign: '-'
  period_id: string
}

export type TransferMovement = BaseMovement & {
  kind: 'transfer'
  title: 'Transferencia'
  sign: null
  destination_account_id: string | null
  destination_account_name: string | null
  destination_account_institution_name: string | null
}

export type AdjustmentMovement = BaseMovement & {
  kind: 'adjustment'
  // 'Ajuste' for real adjustments; settlement legs reuse this structure kind
  // with their own label ("Saldar deuda" / "Pago recibido").
  title: string
  sign: '+' | '-'
}

export type ExchangeMovement = BaseMovement & {
  kind: 'exchange'
  title: 'Cambio'
  // The primary (source) leg is an outflow → negative. The received leg is
  // shown separately as positive.
  sign: '-'
  // `amount` / `currency_code` (from BaseMovement) are the SOURCE leg.
  destination_amount: number
  destination_currency: 'ARS' | 'USD'
  destination_account_id: string | null
  destination_account_name: string | null
  destination_account_institution_name: string | null
}

export type CardInstallmentMovement = BaseMovement & {
  kind: 'installment_purchase'
  title: string
  sign: '-'
  installments_total: number | null
}

export type ReimbursementState = 'pending' | 'received' | 'cancelled'

export type ReimbursementMovement = BaseMovement & {
  kind: 'reimbursement'
  title: string
  // Always an inflow (it gives money back / reduces the card statement).
  sign: '+'
  target: ReimbursementTarget
  state: ReimbursementState
  // The origin expense this reimbursement is linked to.
  linked_transaction_id: string | null
}

export type FinancialMovement =
  | IncomeMovement
  | ExpenseMovement
  | CardPaymentMovement
  | TransferMovement
  | AdjustmentMovement
  | CardInstallmentMovement
  | ExchangeMovement
  | ReimbursementMovement

/**
 * Build the pure `resolveMovementView` input from a (already mapped)
 * FinancialMovement. The neutral movement carries both ends; the resolver
 * projects it onto a perspective. Keeps the perspective logic in money-logic.
 */
export const toMovementViewInput = (m: FinancialMovement): MovementViewInput => ({
  kind: m.kind,
  accountId: m.account_id,
  accountName: m.account_name,
  destinationAccountId:
    m.kind === 'transfer' || m.kind === 'exchange' ? m.destination_account_id : null,
  destinationAccountName:
    m.kind === 'transfer' || m.kind === 'exchange' ? m.destination_account_name : null,
  amount: m.amount,
  currencyCode: m.currency_code,
  destinationAmount: m.kind === 'exchange' ? m.destination_amount : null,
  destinationCurrency: m.kind === 'exchange' ? m.destination_currency : null,
  baseSign: m.sign,
})
