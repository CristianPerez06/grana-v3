import {
  resolveMovementView,
  type MovementKind,
  type MovementView,
} from '@grana/money-logic'
import type {
  TransactionWithDetails,
  TransactionType,
  TransactionCategory,
} from '@grana/transactions'

// Map the DB `type` to the neutral MovementKind the shared projector understands.
// `settlement` has no MovementKind (it isn't part of the categorized/two-legged
// families) and is handled directly below.
const KIND_BY_TYPE: Partial<Record<TransactionType, MovementKind>> = {
  income: 'income',
  expense: 'expense',
  transfer: 'transfer',
  adjustment: 'adjustment',
  exchange: 'exchange',
  reimbursement: 'reimbursement',
}

function baseSign(tx: TransactionWithDetails): '+' | '-' | null {
  switch (tx.type) {
    case 'income':
    case 'reimbursement':
      return '+'
    case 'expense':
    case 'exchange':
      return '-'
    case 'transfer':
      return null
    case 'adjustment':
      // adjustment keeps its sign in the DB (may be negative).
      return tx.amount >= 0 ? '+' : '-'
    default:
      return '-'
  }
}

/**
 * Project a transaction onto this account's perspective (sign/amount/currency/
 * counterparty), reusing the shared `resolveMovementView` so the leg/sign logic
 * is not reimplemented in mobile. `settlement` is signed by its direction here
 * because it falls outside the shared MovementKind set.
 */
export function accountMovementView(
  tx: TransactionWithDetails,
  accountId: string,
): MovementView {
  if (tx.type === 'settlement') {
    return {
      sign: tx.settlement_direction === 'in' ? '+' : '-',
      amount: tx.amount,
      currencyCode: tx.currency_code,
      counterpartyName: null,
      counterpartyDirection: null,
      isCategorized: false,
    }
  }

  return resolveMovementView(
    {
      kind: KIND_BY_TYPE[tx.type] ?? 'expense',
      accountId: tx.account_id,
      accountName: tx.source_account?.name ?? null,
      destinationAccountId: tx.transfer_destination_account_id,
      destinationAccountName: tx.destination_account?.name ?? null,
      amount: tx.amount,
      currencyCode: tx.currency_code,
      destinationAmount: tx.destination_amount,
      destinationCurrency: tx.destination_currency,
      baseSign: baseSign(tx),
    },
    { kind: 'account', accountId },
  )
}

type TranslateFn = (key: string) => string

/** System categories (`user_id === null`) translate via `categories.{canonical}`. */
export function resolveCategoryLabel(
  category: TransactionCategory | null,
  t: TranslateFn,
): string | null {
  if (!category) return null
  return category.user_id === null
    ? t(`categories.${category.canonical_name}`)
    : category.name
}
