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
