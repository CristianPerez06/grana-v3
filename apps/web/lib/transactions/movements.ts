import type {
  AdjustmentMovement,
  FinancialMovement,
  MovementReviewFlag,
  ReimbursementState,
} from '@grana/transactions'
import type { TransactionWithDetails } from './types'

// The `FinancialMovement` union + its view bridge (`toMovementViewInput`) now
// live in `@grana/transactions` so mobile reuses them. Re-exported here so the
// rest of web keeps importing them from `@/lib/transactions/movements`
// unchanged. The DB→movement mappers (`toFinancialMovement`,
// `toInitialBalanceMovement`) stay in web — they read `TransactionWithDetails`
// and are the global feed's concern.
export type {
  FinancialMovement,
  MovementReviewFlag,
  ReimbursementState,
  IncomeMovement,
  ExpenseMovement,
  CardPaymentMovement,
  TransferMovement,
  AdjustmentMovement,
  CardInstallmentMovement,
  ExchangeMovement,
  ReimbursementMovement,
} from '@grana/transactions'
export { toMovementViewInput } from '@grana/transactions'

const detailHref = (tx: TransactionWithDetails) => `/transactions/${tx.id}`

/**
 * Synthetic-id prefix for the per-currency "saldo inicial" rows the account
 * detail injects at display time. These are NOT `transactions` rows — never
 * send their ids to the server (they would fail the uuid cast).
 */
export const INITIAL_BALANCE_ID_PREFIX = 'initial-balance:'

export const isInitialBalanceMovement = (m: FinancialMovement): boolean =>
  m.id.startsWith(INITIAL_BALANCE_ID_PREFIX)

/**
 * Build the synthetic "Saldo inicial" row for one account currency. Shaped as
 * an adjustment so it flows through the shared list (grouping, filters, tone)
 * without a new kind; `detail_href: null` keeps it non-navigable. Only the
 * account detail synthesizes these — the global movements list never sees them.
 */
export const toInitialBalanceMovement = (args: {
  accountId: string
  accountName: string
  currencyCode: 'ARS' | 'USD'
  initialBalance: number
  /** `account_currencies.initial_balance_date` — the account/currency creation day. */
  date: string
  /** `account_currencies.created_at` — sorts the row before same-day transactions. */
  createdAt: string
  /** Localized "Saldo inicial" label (the row's primary line). */
  label: string
}): AdjustmentMovement => ({
  id: `${INITIAL_BALANCE_ID_PREFIX}${args.currencyCode}`,
  date: args.date,
  created_at: args.createdAt,
  amount: Math.abs(args.initialBalance),
  currency_code: args.currencyCode,
  description: args.label,
  account_id: args.accountId,
  account_name: args.accountName,
  account_institution_name: null,
  category_id: null,
  category_name: null,
  category_icon: null,
  category_color: null,
  category_canonical_name: null,
  category_is_system: false,
  subcategory_id: null,
  subcategory_name: null,
  subcategory_canonical_name: null,
  subcategory_is_system: false,
  detail_href: null,
  review_flags: [],
  isShared: false,
  kind: 'adjustment',
  title: args.label,
  sign: args.initialBalance < 0 ? '-' : '+',
})

const getReviewFlags = (tx: TransactionWithDetails): MovementReviewFlag[] => {
  const flags: MovementReviewFlag[] = []

  const isCardPayment = (tx.period_payments?.length ?? 0) > 0

  if ((tx.type === 'income' || tx.type === 'expense') && !tx.category && !isCardPayment) {
    flags.push('missing_category')
  }

  // No fx flag: a USD card consumo without cotización is the NORMAL state —
  // the conversion happens at statement payment (payment-day rate).

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
    account_institution_name: tx.source_account?.institution?.name ?? null,
    category_id: tx.category_id ?? null,
    category_name: tx.category?.name ?? null,
    category_icon: tx.category?.icon ?? null,
    category_color: tx.category?.color ?? null,
    category_canonical_name: tx.category?.canonical_name ?? null,
    category_is_system: tx.category != null && tx.category.user_id === null,
    subcategory_id: tx.subcategory_id ?? null,
    subcategory_name: tx.subcategory?.name ?? null,
    subcategory_canonical_name: tx.subcategory?.canonical_name ?? null,
    subcategory_is_system: tx.subcategory != null && tx.subcategory.user_id === null,
    detail_href: detailHref(tx),
    review_flags: getReviewFlags(tx),
    isShared: tx.is_shared ?? false,
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
    // Category AND subcategory are DERIVED from the linked expense (the
    // reimbursement stores none of its own), so the row reads like its expense.
    const linkedCat = tx.linked_expense?.category ?? null
    const linkedSub = tx.linked_expense?.subcategory ?? null
    // Inherit the origin expense's description so the reimbursement reads the
    // same as its expense in the list (the row's primary line uses `description`).
    const inheritedDesc = tx.linked_expense?.description ?? tx.description
    const state: ReimbursementState = tx.cancelled_at
      ? 'cancelled'
      : tx.received_at
        ? 'received'
        : 'pending'
    return {
      ...base,
      description: inheritedDesc,
      category_id: linkedCat?.id ?? null,
      category_name: linkedCat?.name ?? null,
      category_icon: linkedCat?.icon ?? null,
      category_color: linkedCat?.color ?? null,
      category_canonical_name: linkedCat?.canonical_name ?? null,
      category_is_system: linkedCat != null && linkedCat.user_id === null,
      subcategory_id: linkedSub?.id ?? null,
      subcategory_name: linkedSub?.name ?? null,
      subcategory_canonical_name: linkedSub?.canonical_name ?? null,
      subcategory_is_system: linkedSub != null && linkedSub.user_id === null,
      kind: 'reimbursement',
      title: inheritedDesc ?? 'Reintegro',
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
      destination_account_institution_name: tx.destination_account?.institution?.name ?? null,
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
      destination_account_institution_name: tx.destination_account?.institution?.name ?? null,
    }
  }

  if (tx.type === 'settlement') {
    // A debt settlement leg. Renders as a structure movement (like adjustment)
    // but with its own label and a direction-driven sign.
    const isIn = tx.settlement_direction === 'in'
    return {
      ...base,
      kind: 'adjustment',
      title: isIn ? 'Cobro de deuda compartida' : 'Pago de deuda compartida',
      sign: isIn ? '+' : '-',
    }
  }

  return {
    ...base,
    kind: 'adjustment',
    title: 'Ajuste',
    sign: tx.amount >= 0 ? '+' : '-',
  }
}
