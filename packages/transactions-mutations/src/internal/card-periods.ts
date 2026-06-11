import type { Database, GranaSupabaseClient } from '@grana/supabase'
import {
  assignTransactionToPeriod,
  suggestNextPeriodDates,
  addDaysToISO,
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
 * Rolling automático: find an existing non-paid period covering `targetDate`,
 * or insert a new estimated one using the rolling algorithm. Returns the
 * period id either way.
 */
export async function getOrCreatePeriodForDate(
  supabase: GranaSupabaseClient,
  accountId: string,
  targetDate: string,
  today: Date,
): Promise<string> {
  const periods = await getCardPeriodsWithStatus(supabase, accountId)

  const existing = assignTransactionToPeriod(periods, targetDate)
  if (existing) return existing.id

  // No period covers the date. Rolling generation only ever moves forward: a
  // date BEFORE the oldest known period belongs to a statement that predates
  // the card's history in Grana. Reject instead of creating a future period
  // and misassigning the consumo to it (silent corruption). `periods` is
  // ordered by start_date ASC, so periods[0] is the oldest.
  const oldestPeriod = periods[0]
  if (oldestPeriod && targetDate < oldestPeriod.start_date) {
    throw new CardPurchasePredatesHistoryError(oldestPeriod.start_date)
  }

  const { suggestedEndDate, suggestedDueDate } = suggestNextPeriodDates(periods, today)

  const lastPeriod = periods[periods.length - 1]
  const newStartDate = lastPeriod ? addDaysToISO(lastPeriod.end_date, 1) : targetDate

  const { data: newPeriod, error } = await supabase
    .from('card_periods')
    .insert({
      account_id: accountId,
      start_date: newStartDate,
      end_date: suggestedEndDate,
      due_date: suggestedDueDate,
      is_estimated: true,
    })
    .select('id')
    .single()

  if (error) throw error
  return newPeriod.id
}
