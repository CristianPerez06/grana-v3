// Pure math for the savings row of the balance card (web + mobile): the line
// that lives BELOW A RULE under "Tenías / Entró / Se fué".
//
// It is not a fourth sibling of those three, and the separation is the point.
// Above the rule the card shows how the money MOVED — liquidity, plata entrando
// y saliendo de las cuentas. Below it, how much of it the user decided not to
// touch. Rendering it as a fourth column would claim it is the same kind of
// thing as an income or an expense.
//
// The row shows the TOTAL set aside, not the month's flow, and that choice is
// what makes the card verifiable:
//
//     Tenías + Entró − Se fué − Guardado === Disponible
//
// where `Tenías` is the ACCOUNT BALANCE the month opened with — a number the
// user can check against their own accounts — and `Guardado` is the whole stock,
// carried-over months included. Showing the month's flow instead forces `Tenías`
// to mean "the disponible you opened with", which silently nets earlier reserves
// into a number that never says so: someone adding the three amounts up could
// not reconstruct where those pesos went. Subtracting the stock puts them on
// screen, once, with a name.
//
// The month's flow is not lost — it lives in the savings detail, which is where
// "what did I do this month" belongs.
//
// RN-safe: no DOM/Node deps.

import { Money } from '@grana/validation'

export type SavingsRowState =
  /** There is money set aside. Renders "Guardado" with the total. */
  | 'stock'
  /** Nothing set aside. Renders "Guardar algo", with no amount. */
  | 'empty'

export type SavingsRow = {
  state: SavingsRowState
  /** The total set aside, always POSITIVE. Zero for 'empty'. */
  amount: number
}

/**
 * Which state the savings row is in.
 *
 * @param isCurrentMonth The row exists only in the current month. "Para gastar"
 * at the close of a past month means nothing — the money was either spent or it
 * was not, and saving is a stance about the future, not a fact about the past.
 * The rule lives here so no surface has to remember it.
 * @param reserved The current stock, from `get_available_sums`.
 */
export function deriveSavingsRow(input: {
  isCurrentMonth: boolean
  reserved: number
}): SavingsRow | null {
  if (!input.isCurrentMonth) return null

  const stock = Money.from(input.reserved)
  if (Money.isZero(stock) || Money.isNegative(stock)) return { state: 'empty', amount: 0 }

  return { state: 'stock', amount: input.reserved }
}

/**
 * The term the savings row contributes to the card's identity:
 *
 *     Tenías + Entró − Se fué − savingsIdentityTerm === Disponible
 *
 * It is the STOCK, and it is zero wherever the row does not render — a past
 * month, where the card closes against the closing balance with the three
 * amounts it always had.
 */
export function savingsIdentityTerm(row: SavingsRow | null): number {
  return row ? row.amount : 0
}
