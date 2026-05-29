import type { MovementViewInput } from '@grana/money-logic'
import type { ReimbursementTarget, TransactionWithDetails } from './types'

export type MovementReviewFlag = 'missing_category' | 'missing_fx_rate'

type BaseMovement = {
  id: string
  date: string
  created_at: string
  amount: number
  currency_code: 'ARS' | 'USD'
  description: string | null
  account_id: string | null
  account_name: string | null
  /** Category id/name/emoji/color for filtering, the row icon and subtitle (null when not categorized). */
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  /** Subcategory id/name for the row subtitle (null when not assigned or not applicable). */
  subcategory_id: string | null
  subcategory_name: string | null
  detail_href: string | null
  review_flags: MovementReviewFlag[]
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
}

export type AdjustmentMovement = BaseMovement & {
  kind: 'adjustment'
  title: 'Ajuste'
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

const detailHref = (tx: TransactionWithDetails) => `/transactions/${tx.id}`

const getReviewFlags = (tx: TransactionWithDetails): MovementReviewFlag[] => {
  const flags: MovementReviewFlag[] = []

  const isCardPayment = (tx.period_payments?.length ?? 0) > 0

  if ((tx.type === 'income' || tx.type === 'expense') && !tx.category && !isCardPayment) {
    flags.push('missing_category')
  }

  if (
    tx.source_account?.type === 'credit' &&
    tx.currency_code !== 'ARS' &&
    tx.type === 'expense' &&
    !tx.fx_rate_to_ars
  ) {
    flags.push('missing_fx_rate')
  }

  return flags
}

export const toFinancialMovement = (tx: TransactionWithDetails): FinancialMovement => {
  const base = {
    id: tx.id,
    date: tx.date,
    created_at: tx.created_at,
    amount: Math.abs(tx.amount),
    currency_code: tx.currency_code,
    description: tx.description,
    account_id: tx.account_id,
    account_name: tx.source_account?.name ?? null,
    category_id: tx.category_id ?? null,
    category_name: tx.category?.name ?? null,
    category_icon: tx.category?.icon ?? null,
    category_color: tx.category?.color ?? null,
    subcategory_id: tx.subcategory_id ?? null,
    subcategory_name: tx.subcategory?.name ?? null,
    detail_href: detailHref(tx),
    review_flags: getReviewFlags(tx),
  }

  if (tx.is_parent) {
    return {
      ...base,
      kind: 'installment_purchase',
      title: tx.description ?? tx.category?.name ?? 'Compra en cuotas',
      sign: '-',
      installments_total: tx.installments_total,
    }
  }

  const payment = tx.period_payments?.[0]
  if (payment) {
    return {
      ...base,
      kind: 'card_payment',
      title: 'Pago de resumen',
      sign: '-',
      period_id: payment.period_id,
    }
  }

  if (tx.type === 'reimbursement') {
    // Category is DERIVED from the linked expense (the reimbursement stores none).
    // Subcategory is not derived — `linked_expense` query payload does not
    // include it, and the reimbursement detail view follows the same rule.
    const linkedCat = tx.linked_expense?.category ?? null
    const state: ReimbursementState = tx.cancelled_at
      ? 'cancelled'
      : tx.received_at
        ? 'received'
        : 'pending'
    return {
      ...base,
      category_id: linkedCat?.id ?? null,
      category_name: linkedCat?.name ?? null,
      category_icon: linkedCat?.icon ?? null,
      category_color: linkedCat?.color ?? null,
      subcategory_id: null,
      subcategory_name: null,
      kind: 'reimbursement',
      title: tx.description ?? 'Reintegro',
      sign: '+',
      target: tx.reimbursement_target ?? 'account',
      state,
      linked_transaction_id: tx.linked_transaction_id,
    }
  }

  if (tx.type === 'income') {
    return {
      ...base,
      kind: 'income',
      title: tx.category?.name ?? 'Ingreso',
      sign: '+',
    }
  }

  if (tx.type === 'expense') {
    return {
      ...base,
      kind: 'expense',
      title: tx.category?.name ?? 'Gasto',
      sign: '-',
    }
  }

  if (tx.type === 'transfer') {
    return {
      ...base,
      kind: 'transfer',
      title: 'Transferencia',
      sign: null,
      destination_account_id: tx.transfer_destination_account_id,
      destination_account_name: tx.destination_account?.name ?? null,
    }
  }

  if (tx.type === 'exchange') {
    return {
      ...base,
      kind: 'exchange',
      title: 'Cambio',
      sign: '-',
      destination_amount: tx.destination_amount ?? 0,
      destination_currency: tx.destination_currency ?? 'USD',
      destination_account_id: tx.transfer_destination_account_id,
      destination_account_name: tx.destination_account?.name ?? null,
    }
  }

  return {
    ...base,
    kind: 'adjustment',
    title: 'Ajuste',
    sign: tx.amount >= 0 ? '+' : '-',
  }
}

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
