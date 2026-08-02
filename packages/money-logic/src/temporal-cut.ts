import { formatDateISO, getTodayAR } from './cards'

// ─── Temporal cut ─────────────────────────────────────────────────────────────
//
// A movement dated after today EXISTS (it is listed, it can be edited) but it is
// not yet a fact: it must not reach a number that answers "what do I have" or
// "what did I spend". Migration 0052 established the rule for the balance
// (`get_account_balance_sums` sums only `date <= hoy`); this module is the same
// rule for the MONTH lenses, which read through PostgREST instead of the RPC.
//
// The cut is CAJA-scoped, and that scope is the whole subtlety:
//
//   · on-ledger rows (`status IS NULL` — cash/debit) are cut at today. A future
//     expense has not left the account, so it belongs to neither "Balance del
//     mes" nor "¿En qué gasté?".
//   · card rows (`status` 'pending'/'paid', i.e. `card_period_id` set) are NOT
//     cut. They are off-ledger for CAJA anyway, and for the DEVENGADO lens the
//     accrual unit is the MONTH, not the day: a cuota dated the 20th accrues in
//     its month from day 1 (spec `spending-by-category`). Cutting them would
//     hide spending already incurred until its date arrived.

/**
 * The financial "hoy": the calendar date in `America/Argentina/Buenos_Aires`.
 * Every month read that applies the cut derives its default bound from here, so
 * the cut lands on the same day the rest of the UI renders — never a server
 * clock in UTC, which would move the boundary by up to 3 hours.
 */
export function financialTodayISO(): string {
  return formatDateISO(getTodayAR())
}

/**
 * The earlier of two ISO `YYYY-MM-DD` dates. Lexicographic order IS chronological
 * order in that format, which is why the comparisons here are plain string
 * comparisons and no `Date` is ever constructed (no timezone can creep in).
 */
export function earlierISO(a: string, b: string): string {
  return a <= b ? a : b
}

/**
 * A credit-card accrual row: a consumo or an installment cuota, which carries a
 * `status` ('pending'/'paid') and a `card_period_id`. Off-ledger for CAJA and
 * exempt from the temporal cut under the devengado lens.
 */
export function isCardAccrualRow(row: { status?: string | null }): boolean {
  return row.status != null
}

/**
 * Whether a row survives the temporal cut for a month lens: card accrual rows
 * always do; on-ledger (CAJA) rows only up to `todayISO` inclusive.
 *
 * `todayISO` is injected, never read from a clock in here — the caller owns the
 * "hoy" so tests are deterministic and the whole read agrees on one boundary.
 */
export function countsUnderTemporalCut(
  row: { date: string; status?: string | null },
  todayISO: string,
): boolean {
  return isCardAccrualRow(row) || row.date <= todayISO
}

/**
 * The same rule as a PostgREST `.or()` predicate, so the cut happens in the
 * database and the payload never carries rows the lens would discard:
 *
 *   .or(cajaCutOrFilter(todayISO))   →   (status IS NOT NULL OR date <= hoy)
 *
 * ANDs with the month range already on the query. Reads whose product is a money
 * number must be complete by construction (spec `web-data-access`): this narrows
 * the window, it never truncates it.
 */
export function cajaCutOrFilter(todayISO: string): string {
  return `status.not.is.null,date.lte.${todayISO}`
}
