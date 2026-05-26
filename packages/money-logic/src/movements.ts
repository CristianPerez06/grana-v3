import type { BalanceCurrency } from './balance'

export type MovementKind =
  | 'income'
  | 'expense'
  | 'card_payment'
  | 'transfer'
  | 'adjustment'
  | 'exchange'
  | 'installment_purchase'

/**
 * From which point of view a movement is rendered:
 * - `global`: neutral view (the global Movimientos list). Two-legged movements
 *   show both ends and keep their neutral sign.
 * - `account`: egocentric view from one account (the account detail list). A
 *   transfer/exchange is reinterpreted by how it affects THIS account.
 */
export type MovementPerspective =
  | { kind: 'global' }
  | { kind: 'account'; accountId: string }

/**
 * Neutral, presentation-free description of a movement — enough to project it
 * onto any perspective. The caller (web/mobile) builds this from its own rows;
 * this module never touches React, i18n or styling. `amount` is the absolute
 * source-leg amount; `baseSign` is the sign already decided for the neutral
 * (global) view by the caller's mapper (income `+`, expense/card/installment/
 * exchange `-`, transfer `null`, adjustment `+`/`-`).
 */
export type MovementViewInput = {
  kind: MovementKind
  accountId: string | null
  accountName: string | null
  destinationAccountId: string | null
  destinationAccountName: string | null
  amount: number
  currencyCode: BalanceCurrency
  destinationAmount?: number | null
  destinationCurrency?: BalanceCurrency | null
  baseSign: '+' | '-' | null
}

export type MovementView = {
  /** Effect sign from the perspective. `null` = neutral (no inflow/outflow). */
  sign: '+' | '-' | null
  /** Amount relevant to the perspective (absolute). */
  amount: number
  /** Currency relevant to the perspective. */
  currencyCode: BalanceCurrency
  /** The other account, named from the perspective (`null` when not applicable). */
  counterpartyName: string | null
  /** Counterparty direction relative to the perspective. */
  counterpartyDirection: 'in' | 'out' | null
  /** Whether the movement belongs to the "categorized" icon family. */
  isCategorized: boolean
}

const TWO_LEGGED = new Set<MovementKind>(['transfer', 'exchange'])

const isCategorizedKind = (kind: MovementKind): boolean =>
  kind === 'income' || kind === 'expense' || kind === 'installment_purchase'

/**
 * Project a movement onto a perspective. Pure: same input → same output.
 *
 * Only two-legged movements (transfer, exchange) change with an account
 * perspective; everything else looks the same from anywhere. This is the single
 * source of truth that replaces the duplicated sign/leg logic that used to live
 * in both the global mapper and the account-list `getRowMeta`.
 */
export function resolveMovementView(
  input: MovementViewInput,
  perspective: MovementPerspective,
): MovementView {
  const isCategorized = isCategorizedKind(input.kind)

  if (perspective.kind === 'account' && TWO_LEGGED.has(input.kind)) {
    const isSource = input.accountId === perspective.accountId

    if (isSource) {
      // Money leaves this account → source leg, outflow.
      return {
        sign: '-',
        amount: input.amount,
        currencyCode: input.currencyCode,
        counterpartyName: input.destinationAccountName,
        counterpartyDirection: 'out',
        isCategorized,
      }
    }

    // This account is the destination → received leg, inflow. For an exchange
    // the received leg is in the destination currency/amount; for a transfer it
    // is the same amount/currency.
    const isExchange = input.kind === 'exchange'
    return {
      sign: '+',
      amount: isExchange ? input.destinationAmount ?? 0 : input.amount,
      currencyCode: isExchange ? input.destinationCurrency ?? input.currencyCode : input.currencyCode,
      counterpartyName: input.accountName,
      counterpartyDirection: 'in',
      isCategorized,
    }
  }

  // Global perspective (or a single-account movement): neutral view. A
  // two-legged movement shows its destination as the counterparty.
  const counterpartyName = TWO_LEGGED.has(input.kind) ? input.destinationAccountName : null

  return {
    sign: input.baseSign,
    amount: input.amount,
    currencyCode: input.currencyCode,
    counterpartyName,
    counterpartyDirection: counterpartyName ? 'out' : null,
    isCategorized,
  }
}

/** Functional movement type for editability (`type` column of `transactions`). */
export type MovementType = 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'

/**
 * Everything `getEditableFields` needs, with no I/O. The caller (web/mobile)
 * maps its own transaction model onto this:
 * - `status`: card lifecycle (`pending`/`paid`) or `null` for cash/bank.
 * - `isParent`: installment parent (madre, `is_parent=true`, `account_id=NULL`).
 * - `isCardPayment`: an expense that pays a statement (no category — `payCardPeriod`
 *   inserts it with `category_id=null` on purpose).
 * - `hasPaidInstallment`: only meaningful for a parent — true when any child is `paid`.
 */
export type MovementEditInput = {
  type: MovementType
  status: 'pending' | 'paid' | null
  isParent: boolean
  isCardPayment: boolean
  hasPaidInstallment: boolean
}

/**
 * Which fields a movement exposes for editing, per type and state. A `false`
 * field is either immutable (shown as read-only context) or not applicable to
 * the type. `type`, `currency` and the account(s) are NEVER editable post-
 * creation, so they are not part of this descriptor — they are immutable context.
 * `category`/`subcategory` being `false` means the field is not shown at all
 * (e.g. a statement-payment expense, or any two-legged/adjustment movement).
 */
export type EditableFields = {
  amount: boolean
  date: boolean
  category: boolean
  subcategory: boolean
  description: boolean
  adjustmentDirection: boolean
  /** Received-leg amount of a currency exchange. */
  destinationAmount: boolean
}

/**
 * Single source of truth for movement editability. Pure: same input → same
 * output. Centralizes the rules that used to live duplicated in the edit page
 * (`amountEditable`) and the two scoped edit forms. Does NOT change those rules.
 */
export function getEditableFields(input: MovementEditInput): EditableFields {
  const { type, status, isParent, isCardPayment, hasPaidInstallment } = input

  // Installment parent (madre): category/description always editable; amount only
  // when no child is paid (changing it re-splits the children); date never (the
  // parent's date drives the cuotas' periods).
  if (isParent) {
    return {
      amount: !hasPaidInstallment,
      date: false,
      category: true,
      subcategory: true,
      description: true,
      adjustmentDirection: false,
      destinationAmount: false,
    }
  }

  // A paid single card consumption locks amount + date (only category/desc).
  // Cash/bank movements and unpaid consumptions are not locked (`status` null/pending).
  const locked = status === 'paid'

  switch (type) {
    case 'income':
      return {
        amount: true,
        date: true,
        category: true,
        subcategory: true,
        description: true,
        adjustmentDirection: false,
        destinationAmount: false,
      }
    case 'expense': {
      // A statement-payment expense has no category.
      const category = !isCardPayment
      return {
        amount: !locked,
        date: !locked,
        category,
        subcategory: category,
        description: true,
        adjustmentDirection: false,
        destinationAmount: false,
      }
    }
    case 'transfer':
      return {
        amount: true,
        date: true,
        category: false,
        subcategory: false,
        description: true,
        adjustmentDirection: false,
        destinationAmount: false,
      }
    case 'adjustment':
      return {
        amount: true,
        date: true,
        category: false,
        subcategory: false,
        description: true,
        adjustmentDirection: true,
        destinationAmount: false,
      }
    case 'exchange':
      return {
        amount: true,
        date: true,
        category: false,
        subcategory: false,
        description: true,
        adjustmentDirection: false,
        destinationAmount: true,
      }
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}
