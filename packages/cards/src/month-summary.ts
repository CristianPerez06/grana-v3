import { sumMoneyValues } from '@grana/money-logic'

// Pure aggregation for the cards month hero. No I/O: takes the per-card data
// `getCreditCards()` already produced and derives the hero figures. Lives in its
// own module (like `grouping.ts`) so it can be unit-tested without a DB, and is
// shared by web and mobile from `@grana/cards`.

type CardAlert = 'red' | 'amber' | 'none'

export type UpcomingDue = {
  cardId: string
  cardName: string
  /** Statement close date (ISO). */
  endDate: string
  /** Statement due date (ISO). */
  dueDate: string
  amountARS: number
  amountUSD: number
  alert: CardAlert
  isToPay: boolean
}

export type CardsMonthSummary = {
  /** Sum of all cards' "a pagar" (closed/overdue, unpaid) statements, per currency. */
  toPayARS: number
  toPayUSD: number
  /**
   * Sum of all cards' OPEN statements still accruing ("En curso"), per currency.
   * Real charges already made in the open cycle (a growing floor, not a forecast).
   * Includes the open statement of cards that ALSO have an "a pagar" one.
   */
  inProgressARS: number
  inProgressUSD: number
  /** Whether any active card has a USD ledger (drives showing the USD line). */
  hasUSD: boolean
  /** Whether at least one card has a statement to pay this month. */
  hasToPay: boolean
  /** Closest upcoming due date among all active cards, or null. */
  nextDue: UpcomingDue | null
  /** Next due date of EVERY active card with an active period, by due date asc. */
  upcoming: UpcomingDue[]
  /**
   * Upcoming statement CLOSES (cierres) of the OPEN statement of each card, one
   * row per card, sorted by close date ascending, capped at `NEXT_CLOSES_CAP`.
   * These are CLOSE dates (NOT payment due dates). No amount: the per-card amount
   * lives in each card's detail below the hero.
   */
  nextCloses: { endDate: string; cardName: string }[]
}

/** How many upcoming closes the hero lists (one row per card). */
export const NEXT_CLOSES_CAP = 6

/** Minimal per-card shape this aggregation reads. `CreditCardSummary` satisfies it. */
export type MonthSummaryCard = {
  id: string
  name: string
  currencies: Array<{ currency_code: string; is_active: boolean }>
  activePeriod: {
    end_date: string
    due_date: string
    tx_count: number
    has_payment: boolean
    pendingAmountARS: number
    pendingAmountUSD: number
    alert: CardAlert
  } | null
  inProgress: { endDate: string; amountARS: number; amountUSD: number } | null
}

/**
 * Three distinct concepts feed the hero:
 *
 * - "A pagar (ahora)" (`toPayARS`/`toPayUSD`): statements already CLOSED and
 *   unpaid (`closed`/`overdue` with charges). Firm debt.
 * - "En curso" (`inProgressARS`/`inProgressUSD`): each card's OPEN statement
 *   still accruing — including the open statement of a card that ALSO has an
 *   "a pagar" one (two live statements). Real charges so far, a growing floor.
 * - "Próximos cierres" (`nextCloses`): one row per card with an open statement
 *   (close date + card name, no amount), by close date asc, capped at NEXT_CLOSES_CAP.
 *
 * ARS and USD are summed SEPARATELY, never converted (Bimoneda). "A pagar" and
 * "En curso" never overlap: a period is either closed (→ "a pagar") or open
 * (→ "En curso"), never both — the open statement's `end_date` is always >= today.
 */
export function summarizeCardsMonth(
  cards: MonthSummaryCard[],
  todayStr: string,
): CardsMonthSummary {
  const upcoming: UpcomingDue[] = []
  const nextCloses: CardsMonthSummary['nextCloses'] = []
  let toPayARS = 0
  let toPayUSD = 0
  let inProgressARS = 0
  let inProgressUSD = 0
  let hasUSD = false
  let hasToPay = false

  for (const card of cards) {
    if (card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)) {
      hasUSD = true
    }

    // "En curso": the open statement of every card, independent of the "a pagar"
    // logic below (a card can have both a closed-unpaid and an open statement).
    // The open statement's end_date is always >= today, so it never overlaps the
    // "a pagar" set.
    if (card.inProgress) {
      inProgressARS = sumMoneyValues([inProgressARS, card.inProgress.amountARS])
      inProgressUSD = sumMoneyValues([inProgressUSD, card.inProgress.amountUSD])
      // Every card with an open statement shows its upcoming close (date only).
      nextCloses.push({ endDate: card.inProgress.endDate, cardName: card.name })
    }

    const period = card.activePeriod
    if (!period || period.has_payment) continue

    // A statement counts as "a pagar" once it has closed and remains unpaid.
    const isToPay =
      (period.end_date < todayStr || period.due_date < todayStr) && period.tx_count > 0

    if (isToPay) {
      hasToPay = true
      toPayARS = sumMoneyValues([toPayARS, period.pendingAmountARS])
      toPayUSD = sumMoneyValues([toPayUSD, period.pendingAmountUSD])
    }

    // Every active card with an active period contributes its next due date.
    upcoming.push({
      cardId: card.id,
      cardName: card.name,
      endDate: period.end_date,
      dueDate: period.due_date,
      amountARS: period.pendingAmountARS,
      amountUSD: period.pendingAmountUSD,
      alert: period.alert,
      isToPay,
    })
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Próximos cierres: the open statement of each card, by close date ascending,
  // capped at NEXT_CLOSES_CAP.
  nextCloses.sort(
    (a, b) => a.endDate.localeCompare(b.endDate) || a.cardName.localeCompare(b.cardName),
  )

  return {
    toPayARS,
    toPayUSD,
    inProgressARS,
    inProgressUSD,
    hasUSD,
    hasToPay,
    nextDue: upcoming[0] ?? null,
    upcoming,
    nextCloses: nextCloses.slice(0, NEXT_CLOSES_CAP),
  }
}
