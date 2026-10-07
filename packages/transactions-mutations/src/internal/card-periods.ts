import type { Database, GranaSupabaseClient } from '@grana/supabase'
import {
  assignTransactionToPeriod,
  planPeriodRollForward,
  suggestNextPeriodDates,
} from '@grana/money-logic'

type CardPeriodRow = Database['public']['Tables']['card_periods']['Row']

/**
 * Thrown when a purchase date precedes the start of the card's oldest known
 * period. Such a date belongs to a statement Grana never tracked (registration
 * starts at card creation), so the system rejects it instead of inventing a
 * future period and misassigning the consumo. `oldestStartDate` is the ISO
 * date the orchestrators surface to the user as the history anchor.
 */
export class CardPurchasePredatesHistoryError extends Error {
  constructor(public readonly oldestStartDate: string) {
    super(`purchase date precedes card history (oldest start ${oldestStartDate})`)
    this.name = 'CardPurchasePredatesHistoryError'
  }
}

/**
 * Thrown when a card transaction's date falls inside a period whose statement is
 * already PAID. The statement is closed and settled, so a new consumo cannot be
 * imputed there — the assignment rejects instead of fabricating a future frontier
 * period that does not contain the date (the old bug: a `2026-06-25` consumo whose
 * paid statement closed that day landed in an estimated `2026-10-24 → 2026-11-23`).
 * `periodStart`/`periodEnd` are the ISO bounds of the colliding paid statement.
 * Honors the `period_already_paid` requirement.
 */
export class CardConsumoInPaidPeriodError extends Error {
  constructor(
    public readonly periodStart: string,
    public readonly periodEnd: string,
  ) {
    super(`consumo date falls in a paid statement (${periodStart}..${periodEnd})`)
    this.name = 'CardConsumoInPaidPeriodError'
  }
}

/**
 * Thrown when a date is inside the tracked history range but no period covers it
 * and no PAID period covers it either — a gap between periods. Contiguous periods
 * make this unreachable in practice; it guards against fabricating a frontier
 * period for a date the rolling algorithm cannot legitimately place.
 */
export class CardConsumoUnassignableError extends Error {
  constructor(public readonly targetDate: string) {
    super(`no period covers ${targetDate} and it is not beyond the frontier`)
    this.name = 'CardConsumoUnassignableError'
  }
}

/**
 * Full DB row + payment/count fields. The narrower
 * `@grana/money-logic` `CardPeriodWithPayment` is a structural subset; this
 * package returns the full row because `.select('*')` does, and consumers
 * (the read paths in each app) need fields like `account_id` and
 * `is_estimated`.
 */
export type CardPeriodWithPayment = CardPeriodRow & {
  has_payment: boolean
  tx_count: number
}

/**
 * Fetch all periods for a card account joined with payment + transaction-count
 * data. Used by orchestrators to validate that an installment doesn't land in
 * an already-paid period (backdate guard).
 *
 * `today` is the platform's current AR date. Required as a parameter because
 * `getTodayAR()` is not yet shared cross-platform (web `lib/date.ts` vs mobile
 * `apps/mobile/lib/date.ts`); consolidating that helper is scoped to task 7.6.
 */
export async function getCardPeriodsWithStatus(
  supabase: GranaSupabaseClient,
  accountId: string,
): Promise<CardPeriodWithPayment[]> {
  const { data: periods, error } = await supabase
    .from('card_periods')
    .select('*')
    .eq('account_id', accountId)
    .order('start_date', { ascending: true })

  if (error) throw error
  if (!periods || periods.length === 0) return []

  const periodIds = periods.map((p) => p.id)

  const [paymentsResult, txResult] = await Promise.all([
    supabase.from('period_payments').select('period_id').in('period_id', periodIds),
    supabase
      .from('transactions')
      .select('card_period_id')
      .in('card_period_id', periodIds)
      .eq('is_parent', false),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (txResult.error) throw txResult.error

  const paidIds = new Set((paymentsResult.data ?? []).map((p) => p.period_id))
  const countByPeriod = new Map<string, number>()
  for (const tx of txResult.data ?? []) {
    if (tx.card_period_id) {
      countByPeriod.set(tx.card_period_id, (countByPeriod.get(tx.card_period_id) ?? 0) + 1)
    }
  }

  return periods.map((p) => ({
    ...p,
    has_payment: paidIds.has(p.id),
    tx_count: countByPeriod.get(p.id) ?? 0,
  }))
}

/**
 * Resolve the `card_periods` id a transaction dated `targetDate` must be imputed
 * to. Classifies the date instead of blindly rolling forward — `periods` is
 * ordered by start_date ASC:
 *
 *  1. A NON-paid period covers the date (cierre incluido) → use it.
 *  2. A PAID period covers the date → reject (`CardConsumoInPaidPeriodError`).
 *     The statement is closed and settled; a new consumo cannot land there.
 *  3. The date is before the oldest known period → reject
 *     (`CardPurchasePredatesHistoryError`): it predates the card's history.
 *  4. The date is STRICTLY after the last known period → roll forward: create the
 *     next estimated period and impute there. This is the ONLY branch that inserts.
 *  5. Otherwise the date sits inside the tracked range but no period covers it
 *     (a gap) → reject (`CardConsumoUnassignableError`). Never fabricate a
 *     frontier period for it — that was the bug that dumped past-dated consumos
 *     into far-future statements.
 */
export async function getOrCreatePeriodForDate(
  supabase: GranaSupabaseClient,
  accountId: string,
  targetDate: string,
  today: Date,
): Promise<string> {
  const periods = await getCardPeriodsWithStatus(supabase, accountId)

  // 1. A non-paid period covering the date (assignTransactionToPeriod filters
  //    `!has_payment` and is inclusive on both bounds, so the cierre day counts).
  const existing = assignTransactionToPeriod(periods, targetDate)
  if (existing) return existing.id

  // assignTransactionToPeriod returned null for one of several distinct reasons.
  // The fallback must NOT treat them all as "roll forward".

  // 2. A PAID period covers the date. The statement is closed and settled — the
  //    consumo cannot be imputed there, and fabricating a future frontier period
  //    (the old behavior) misassigns it. Reject: honors `period_already_paid`.
  const paidCover = periods.find(
    (p) => p.has_payment && p.start_date <= targetDate && targetDate <= p.end_date,
  )
  if (paidCover) {
    throw new CardConsumoInPaidPeriodError(paidCover.start_date, paidCover.end_date)
  }

  // 3. Before the oldest known period → predates the card's history in Grana.
  const oldestPeriod = periods[0]
  if (oldestPeriod && targetDate < oldestPeriod.start_date) {
    throw new CardPurchasePredatesHistoryError(oldestPeriod.start_date)
  }

  // 4. Strictly after the last known period → legitimate roll-forward. This is
  //    the only path that creates a period.
  const lastPeriod = periods[periods.length - 1]
  if (!lastPeriod || targetDate > lastPeriod.end_date) {
    if (!lastPeriod) {
      // No history to anchor on (cards are always created with periods; kept for
      // safety): a single estimated period starting on the date itself.
      const { suggestedEndDate, suggestedDueDate } = suggestNextPeriodDates([], today)
      const { data: newPeriod, error } = await supabase
        .from('card_periods')
        .insert({
          account_id: accountId,
          start_date: targetDate,
          end_date: suggestedEndDate,
          due_date: suggestedDueDate,
          is_estimated: true,
        })
        .select('id')
        .single()
      if (error) throw error
      return newPeriod.id
    }

    // Create EVERY missing period up to the date — one is not enough when the
    // card sat unused for months — and impute to the one that contains it.
    const created = await rollCardPeriodsForward(supabase, accountId, targetDate, today, periods)
    const cover = created.find((p) => p.start_date <= targetDate && targetDate <= p.end_date)
    if (!cover) throw new CardConsumoUnassignableError(targetDate)
    return cover.id
  }

  // 5. Inside the tracked range but uncovered and not paid-covered — a gap. With
  //    contiguous periods this is unreachable; reject rather than misassign.
  throw new CardConsumoUnassignableError(targetDate)
}

/**
 * Create the estimated periods a card is missing so that one covers
 * `throughDate` (I-CRED-12, lazy maintenance). Shared by consumo imputation and
 * by the card reads, which roll the calendar up to today before reading it.
 * Idempotent: with a period already reaching `throughDate` it writes nothing.
 * A concurrent request that wins the UNIQUE (account_id, start_date) is not an
 * error — its row is read back and used. Returns the periods created (or
 * recovered), in order.
 */
export async function rollCardPeriodsForward(
  supabase: GranaSupabaseClient,
  accountId: string,
  throughDate: string,
  today: Date,
  knownPeriods?: Array<{ start_date: string; end_date: string; due_date: string }>,
): Promise<Array<{ id: string; start_date: string; end_date: string; due_date: string }>> {
  let periods = knownPeriods
  if (!periods) {
    const { data, error } = await supabase
      .from('card_periods')
      .select('start_date, end_date, due_date')
      .eq('account_id', accountId)
      .order('start_date', { ascending: true })
    if (error) throw error
    periods = data ?? []
  }

  const plan = planPeriodRollForward(periods, throughDate, today)
  const created: Array<{ id: string; start_date: string; end_date: string; due_date: string }> = []

  for (const planned of plan) {
    const { data: row, error } = await supabase
      .from('card_periods')
      .insert({ account_id: accountId, ...planned, is_estimated: true })
      .select('id')
      .single()

    if (error && error.code === '23505') {
      // Another request rolled the same period first: use what it wrote.
      const { data: existing, error: readError } = await supabase
        .from('card_periods')
        .select('id, start_date, end_date, due_date')
        .eq('account_id', accountId)
        .eq('start_date', planned.start_date)
        .single()
      if (readError) throw readError
      created.push(existing)
      continue
    }
    if (error) throw error
    created.push({ id: row.id, ...planned })
  }

  return created
}
