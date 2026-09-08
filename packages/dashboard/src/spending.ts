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
 * "124.036.138%" tells you nothing you can act on. The line is where the ratio
 * stops being informative, not where it gets big.
 *
 * Set at 30× — lowered from 100×, which sat past the point where the multiple
 * says anything. The case that moved it is ordinary, not exotic: an account
 * that pays interest credits a few thousand pesos a month on its own, and for
 * someone who does not register a salary here those interest rows ARE the
 * month's income. Against real spending that reads "you spent 100× your
 * income" — arithmetically right, and the reader's reaction to it is the same
 * sentence the overflow state exists to say out loud. It was a hair from
 * saying it: the real month measured 9.971%, under the old line by 29 points.
 *
 * 30× is the LOWEST line that contradicts nothing already decided: a month at
 * ten times your income keeps its number (extraordinary but perfectly legible,
 * which is why the tests below pin it), and so does one at twenty-five. Only
 * the range where the multiple stopped meaning anything moves to the state
 * that shows the two amounts instead — and those amounts are what let the
 * reader see the denominator is interest, which no percentage could tell them.
 */
export const PACE_OVERFLOW_PCT = 3_000

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
      /**
       * The same ratio as a MULTIPLE. Past 100% a percentage stops being the
       * right unit — "1020%" has to be decoded, "10 veces" does not — so the
       * `over` state reads in multiples. Unused while `ok`.
       */
      times: number
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
    // One decimal below 10× (1,5 veces reads better than 2), whole above it.
    times: pct >= 1_000 ? Math.round(pct / 100) : Math.round(pct / 10) / 10,
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

/**
 * How much room a formatted amount needs, so both platforms shrink their type at
 * the SAME point instead of each guessing.
 *
 * The tiles of "Cuánto gastaste" are a third of a card wide and have to hold up
 * to ten digits plus cents (`$ 1.234.567.890,00`, eighteen characters). At the
 * headline size that overflows, and clipping a money amount is the worst
 * possible failure — a truncated "$ 1.020.283,17" reads as a different number.
 *
 * The step is derived from the character count of the formatted string, which is
 * what actually consumes width: digits, thousand separators, the symbol and the
 * optional cents.
 */
export type AmountDensity = 'normal' | 'tight' | 'tighter' | 'tightest'

export function amountDensity(value: number, withCents: boolean): AmountDensity {
  const digits = Math.floor(Math.abs(value)).toString().length
  const separators = Math.floor((digits - 1) / 3)
  const sign = value < 0 ? 1 : 0
  // "$ " + digits + separators + optional ",00" + optional "-"
  const chars = 2 + digits + separators + (withCents ? 3 : 0) + sign

  if (chars <= 13) return 'normal'
  if (chars <= 15) return 'tight'
  if (chars <= 17) return 'tighter'
  return 'tightest'
}

/** Steps from roomiest to tightest — the order `densestAmountDensity` folds on. */
const DENSITY_ORDER: AmountDensity[] = ['normal', 'tight', 'tighter', 'tightest']

/**
 * The step that fits ALL of `values` — the tightest any one of them needs.
 *
 * A row of peer amounts is one decision, not N. Sizing each tile on its own
 * amount makes the type jump from tile to tile, and because the content is
 * vertically centred, a taller amount also pushes its whole tile out of line
 * with its neighbours. Worse, it inverts the hierarchy: "Gastaste
 * $ 1.020.283,17" rendered SMALLER than "Por pagar $ 79.894,67", so the headline
 * number looked subordinate to the one derived from it.
 *
 * Same rule the USD line already follows: decided once for the block.
 */
export function densestAmountDensity(values: number[], withCents: boolean): AmountDensity {
  let index = 0
  for (const value of values) {
    index = Math.max(index, DENSITY_ORDER.indexOf(amountDensity(value, withCents)))
  }
  return DENSITY_ORDER[index]
}
