// Pure math for the savings row of the balance card (web + mobile): the line
// that lives BELOW A RULE under "Tenías / Entró / Se fué".
//
// It is not a fourth sibling of those three, and the separation is the point.
// The strip of three is LIQUIDITY — money entering and leaving the accounts —
// and saving is neither: it is a decision about money that stayed exactly where
// it was. Rendering it as a fourth column would claim it is the same kind of
// thing as an income or an expense.
//
// The row is ALWAYS present in the current month, in one of four states. Showing
// it only when there was activity would leave two everyday holes: someone who
// saved in August and touched nothing in September would see the hero
// subtracting money the screen never names, with no way to reach the detail; and
// someone who dismissed the suggestion and changed their mind three days later
// would have no way back. The act needs a door that does not depend on having
// already used it.
//
// RN-safe: no DOM/Node deps.

import { Money } from '@grana/validation'

export type SavingsRowState =
  /** Net saved this period. Renders "Guardaste este mes" with a MINUS sign. */
  | 'saved'
  /** Net released this period. Renders "Liberaste este mes" with a PLUS sign. */
  | 'released'
  /** No movement this period, but there is a stock. Renders "Guardado". */
  | 'stock'
  /** Nothing saved at all. Renders "Guardar algo", with no amount. */
  | 'empty'

export type SavingsRow = {
  state: SavingsRowState
  /**
   * The magnitude to render, always POSITIVE. The sign shown on screen comes
   * from the state, never from this number: a consumer that formatted a raw
   * signed net would eventually print "Guardaste este mes +$50.000", which says
   * the opposite of what happened.
   */
  amount: number
}

/**
 * Which state the savings row is in.
 *
 * @param isCurrentMonth The row exists only in the current month. "Para gastar"
 * at the close of a past month means nothing — the money was either spent or it
 * was not, and saving is a stance about the future, not a fact about the past.
 * The rule lives here so no surface has to remember it.
 * @param reservedNet Signed net of the period, from `get_reserve_flow_sums`.
 * @param reserved Current stock, from `get_available_sums`.
 */
export function deriveSavingsRow(input: {
  isCurrentMonth: boolean
  reservedNet: number
  reserved: number
}): SavingsRow | null {
  if (!input.isCurrentMonth) return null

  const net = Money.from(input.reservedNet)

  if (!Money.isZero(net)) {
    return {
      state: Money.isNegative(net) ? 'released' : 'saved',
      amount: Math.abs(input.reservedNet),
    }
  }

  // No flow this period. The row stops being a term of the card's identity and
  // becomes a readout of the stock — which is why the three amounts still close
  // against the hero on their own: there is nothing to account for.
  const stock = Money.from(input.reserved)
  if (Money.isZero(stock) || Money.isNegative(stock)) return { state: 'empty', amount: 0 }

  return { state: 'stock', amount: input.reserved }
}

/**
 * The term the savings row contributes to the card's identity:
 *
 *     Tenías + Entró − Se fué − savingsIdentityTerm === Disponible
 *
 * Only a FLOW participates. A stock readout contributes zero, because the
 * carried-over reserve is already baked into "Tenías" — which is the disponible
 * the user opened the month with, not the raw balance.
 */
export function savingsIdentityTerm(row: SavingsRow | null, reservedNet: number): number {
  if (!row) return 0
  return row.state === 'saved' || row.state === 'released' ? reservedNet : 0
}
