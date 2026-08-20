// Pure math for the "Cuánto gastaste" card and the "Compromisos" bar (web +
// mobile). Everything here is display-derived: no read, no side effect, so both
// platforms show the same number and the edge cases are testable without UI.
//
// RN-safe: no DOM/Node deps.

export type OutlookCurrency = 'ARS' | 'USD'

export type MonthSpending = {
  /** Total accrued expense of the month, card purchases included. */
  gastaste: number
  /** Of that, the part that already left the accounts. */
  pagaste: number
  /**
   * `gastaste - pagaste`: the month's expenses put on a credit card, still to be
   * paid in an upcoming statement. Clamped at zero — see `deriveMonthSpending`.
   */
  teQuedaPorPagar: number
}

/**
 * Split the month's expense into what already left the accounts and what is
 * still riding on a card.
 *
 * `accrued` comes from the category breakdown (every expense of the month) and
 * `cash` from the balance series (`totalExpense`, the part that moved money out
 * of a cash/bank account). Their difference is what a credit card financed.
 *
 * The difference is clamped at zero and `pagaste` capped at `gastaste` so the
 * three always reconcile in the UI. They can disagree transiently while the two
 * reads resolve at different times (they are separate queries), and a negative
 * "te queda por pagar" would render as a nonsense amount rather than as the
 * loading state it actually is.
 */
export function deriveMonthSpending(accrued: number, cash: number): MonthSpending {
  const gastaste = Math.max(accrued, 0)
  const pagaste = Math.min(Math.max(cash, 0), gastaste)
  return {
    gastaste,
    pagaste,
    teQuedaPorPagar: Math.round((gastaste - pagaste) * 100) / 100,
  }
}

/**
 * Past this ratio the percentage stops being a reading and becomes noise:
 * "124.036.138%" tells you nothing you can act on. Reachable with real data —
 * a month whose only income was a few cents, against ordinary spending.
 *
 * Set at 100× rather than something tighter so that a genuinely extreme but
 * still legible month (spending ten times your income) keeps showing its number.
 * The line is where the ratio stops being informative, not where it gets big.
 */
export const PACE_OVERFLOW_PCT = 10_000

export type SpendingPace =
  | {
      /**
       * No income credited this month, so the ratio has no denominator. This is
       * NOT zero percent: it is "cannot be computed yet", and the UI must say so
       * instead of drawing an empty ring. Common at the start of a month, before
       * the salary lands.
       */
      status: 'indeterminate'
      spent: number
      income: 0
    }
  | {
      /**
       * The ratio ran past `PACE_OVERFLOW_PCT`. There IS income — so this is not
       * `indeterminate` — but the percentage no longer says anything, and a
       * capped number like "+999%" would not say much more. The UI drops the
       * ring and speaks plainly instead, with the two amounts that produced it.
       */
      status: 'overflow'
      pct: number
      spent: number
      income: number
    }
  | {
      status: 'ok' | 'over'
      /** Spent over income, as a percentage. `over` means it exceeded 100. */
      pct: number
      /** Ring/bar fill, capped at 100 so the arc cannot wrap around itself. */
      fillPct: number
      spent: number
      income: number
    }

/**
 * Pace of the month: what you spent against what actually came in.
 *
 * The denominator is the income credited THIS month, not a configured monthly
 * target — the app has no such field, and deriving one from history would make
 * the number drift for reasons the user cannot see.
 *
 * The consequence is deliberate and has to be handled by the UI: early in the
 * month the denominator is zero (`indeterminate`), and a month where you spend
 * more than you earned reads over 100% (`over`). Both are ordinary states here,
 * not rare alarms.
 *
 * A denominator close to zero — a month whose only income is a few cents — sends
 * the ratio into the millions. That gets its own `overflow` status: income DID
 * arrive, so calling it `indeterminate` would be a lie, but the percentage is no
 * longer a reading. The UI drops the ring there and says so in words.
 *
 * The ratio only ever looks at THE MONTH: what came in and what was spent inside
 * it. A balance carried from previous months never participates — the pace asks
 * "how did this month go", not "how are you doing overall".
 */
export function deriveSpendingPace(spent: number, income: number): SpendingPace {
  const safeSpent = Math.max(spent, 0)
  if (income <= 0) return { status: 'indeterminate', spent: safeSpent, income: 0 }

  const pct = Math.round((safeSpent / income) * 100)
  if (pct > PACE_OVERFLOW_PCT) return { status: 'overflow', pct, spent: safeSpent, income }

  return {
    status: pct > 100 ? 'over' : 'ok',
    pct,
    fillPct: Math.min(pct, 100),
    spent: safeSpent,
    income,
  }
}

export type CommittedSplit = {
  total: number
  cards: number
  recurring: number
  /** Share of the total, 0–100. Zero when there is nothing committed. */
  cardsPct: number
  recurringPct: number
  /** False when nothing is committed: the UI renders no bar instead of a fake one. */
  hasBar: boolean
}

/**
 * Split the committed total between cards and fixed expenses.
 *
 * The percentages are derived from the total, never hardcoded, and an empty
 * month yields `hasBar: false` so the UI does not paint a stacked bar out of
 * arbitrary proportions.
 */
export function deriveCommittedSplit(cards: number, recurring: number): CommittedSplit {
  const safeCards = Math.max(cards, 0)
  const safeRecurring = Math.max(recurring, 0)
  const total = safeCards + safeRecurring

  if (total <= 0) {
    return { total: 0, cards: 0, recurring: 0, cardsPct: 0, recurringPct: 0, hasBar: false }
  }

  return {
    total,
    cards: safeCards,
    recurring: safeRecurring,
    cardsPct: (safeCards / total) * 100,
    recurringPct: (safeRecurring / total) * 100,
    hasBar: true,
  }
}
