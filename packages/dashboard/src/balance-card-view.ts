// What the balance card SHOWS, decided once for both platforms.
//
// Three choices live here and each one has a way of going wrong on its own:
//
//   1. Which number the dark zone renders — the disponible real in the current
//      month, the closing balance in a past one.
//   2. Whether the savings row exists, and what it shows.
//   3. What "Tenías" derives from, so the card closes against the number above
//      it in both cases:
//
//          Tenías + Entró − Se fué − Guardado === lo que dice la zona oscura
//
// They used to be spelled out twice, once in the web hook and once in the native
// card, which is exactly the shape that produced the divergence migration 0051
// had to undo: the same rule copied into two call sites until one of them was
// edited and the other was not.
//
// RN-safe: no DOM/Node deps.

import { deriveMonthOpening } from './month-opening'
import { deriveSavingsRow, savingsIdentityTerm, type SavingsRow } from './savings-row'
import type { MonthSummary } from './month-summary'

type ByCurrency = { ARS: number; USD: number }

export type BalanceCardView = {
  /**
   * The amount the dark zone renders, per currency. The accounts total is NOT
   * replaced by it: "Dónde está" is the LOCATION cut and its percentages are
   * shares of the money held in each account, which a reserve does not belong to.
   */
  displayed: ByCurrency
  savings: { ARS: SavingsRow | null; USD: SavingsRow | null }
  /** Null until both the balance and the month's flows have arrived. */
  venia: ByCurrency | null
}

export function deriveBalanceCardView(input: {
  /** Whether the selected month is the current one. */
  isCurrent: boolean
  /** Accounts total per currency, from the hero. Null while it loads. */
  accounts: ByCurrency | null
  /**
   * The disponible and the reserved stock, from `get_available_sums`. Null in a
   * past month, where the reserve is deliberately NOT netted: at the close of a
   * month gone by the money was either spent or it was not, and a reserve is a
   * stance about the future. Netting it there would also rewrite history on
   * every save — May would read one number on Monday and another on Tuesday
   * without anything having happened in May.
   */
  available: { available: ByCurrency; reserved: ByCurrency } | null
  /** The month's flows. Null while they load. */
  summary: { ARS: MonthSummary; USD: MonthSummary } | null
}): BalanceCardView {
  const { isCurrent, accounts, available, summary } = input

  const displayed: ByCurrency = {
    ARS: available?.available.ARS ?? accounts?.ARS ?? 0,
    USD: available?.available.USD ?? accounts?.USD ?? 0,
  }

  const savings = {
    ARS: deriveSavingsRow({ isCurrentMonth: isCurrent, reserved: available?.reserved.ARS ?? 0 }),
    USD: deriveSavingsRow({ isCurrentMonth: isCurrent, reserved: available?.reserved.USD ?? 0 }),
  }

  return {
    displayed,
    savings,
    // "Tenías" es el SALDO DE CUENTAS con el que se abrió el mes, y sale solo:
    // el disponible ya tiene el guardado restado, así que devolvérselo deja el
    // saldo. Mismo significado en un mes pasado que en el corriente — antes
    // dependía de dónde estabas parado, que era la peor parte.
    venia:
      accounts && summary
        ? {
            ARS: deriveMonthOpening(displayed.ARS, summary.ARS, savingsIdentityTerm(savings.ARS)),
            USD: deriveMonthOpening(displayed.USD, summary.USD, savingsIdentityTerm(savings.USD)),
          }
        : null,
  }
}
