import type { TransactionWithDetails } from './types'

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

export type FinancialMovement =
  | IncomeMovement
  | ExpenseMovement
  | CardPaymentMovement
  | TransferMovement
  | AdjustmentMovement
  | CardInstallmentMovement
  | ExchangeMovement

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
