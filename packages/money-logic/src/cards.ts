import { Money } from '@grana/validation'

// Minimal type used by the period-status logic. The full row in DB has more
// columns (id, account_id, is_estimated, etc.) — the pure functions only need
// the date fields plus the derived flags from related tables.
export type CardPeriodWithPayment = {
  id: string
  start_date: string
  end_date: string
  due_date: string
  has_payment: boolean
  tx_count: number
}

export type PeriodStatus = 'open' | 'closed' | 'overdue' | 'paid'

export type PeriodVariant =
  | 'futuro'
  | 'actual'
  | 'tarjeta_nueva'
  | 'cerrado_esperando_pago'
  | 'vencido'
  | 'pagado'

// ─── Period status / variant derivation ───────────────────────────────────────

export function derivePeriodStatus(
  period: { end_date: string; due_date: string },
  today: Date,
  hasPayment: boolean,
): PeriodStatus {
  if (hasPayment) return 'paid'

  const todayStr = formatDateISO(today)
  if (todayStr <= period.end_date) return 'open'
  if (todayStr <= period.due_date) return 'closed'
  return 'overdue'
}

export function derivePeriodVariant(
  period: { start_date: string; end_date: string; due_date: string },
  today: Date,
  hasPayment: boolean,
  txCount: number,
): PeriodVariant {
  const status = derivePeriodStatus(period, today, hasPayment)

  if (status === 'paid') return 'pagado'
  if (status === 'overdue') return 'vencido'
  if (status === 'closed') return 'cerrado_esperando_pago'

  // status === 'open'
  const todayStr = formatDateISO(today)
  if (period.start_date > todayStr) return 'futuro'
  if (txCount === 0) return 'tarjeta_nueva'
  return 'actual'
}

// ─── Statement lifecycle classification ───────────────────────────────────────

/**
 * Classify a card's periods into the three coexisting statements of an
 * Argentine credit card lifecycle, around which the detail screen is built:
 *
 * - `apagar`: a statement that already CLOSED but is not yet paid (`closed` or
 *   `overdue`) and has transactions imputed — what the user must pay now.
 *   `null` when everything is up to date.
 * - `curso`: the OPEN statement that contains `today` — still accruing charges.
 *   Falls back to the latest unpaid period when no open period contains today
 *   (so the screen always has a "current" anchor).
 * - `prox`: the first period chronologically AFTER `curso` (real row), or
 *   `null` when none exists yet (the caller may project one with
 *   `suggestNextPeriodDates`, which this pure function does not do).
 *
 * The three are mutually exclusive: a period chosen as `apagar` is never also
 * `curso` or `prox`. Pure: same input → same output.
 */
export function classifyPeriodsLifecycle<P extends CardPeriodWithPayment>(
  periods: P[],
  today: Date,
): { apagar: P | null; curso: P | null; prox: P | null } {
  if (periods.length === 0) return { apagar: null, curso: null, prox: null }

  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const todayStr = formatDateISO(today)
  const unpaid = sorted.filter((p) => !p.has_payment)

  // "A pagar": prefer overdue-with-debt, then closed-with-debt. Most urgent first.
  const apagar =
    unpaid.find(
      (p) => derivePeriodStatus(p, today, false) === 'overdue' && p.tx_count > 0,
    ) ??
    unpaid.find(
      (p) => derivePeriodStatus(p, today, false) === 'closed' && p.tx_count > 0,
    ) ??
    null

  // "En curso": the open period containing today; fallback to the latest unpaid
  // period that is not the one already taken by `apagar`.
  const openNow = unpaid.find(
    (p) => p.start_date <= todayStr && todayStr <= p.end_date,
  )
  const curso =
    openNow ??
    [...unpaid].reverse().find((p) => p.id !== apagar?.id) ??
    null

  // "Próximo": first period chronologically after `curso` (or after `apagar`
  // when there is no `curso`), excluding the ones already picked.
  const anchor = curso ?? apagar
  const prox = anchor
    ? sorted.find(
        (p) =>
          p.start_date > anchor.start_date &&
          p.id !== apagar?.id &&
          p.id !== curso?.id,
      ) ?? null
    : null

  return { apagar, curso, prox }
}

// ─── Next-period date suggestion ──────────────────────────────────────────────

export function suggestNextPeriodDates(
  periods: Array<{ end_date: string; due_date: string }>,
  today: Date,
): { suggestedEndDate: string; suggestedDueDate: string } {
  const sorted = [...periods].sort((a, b) => a.end_date.localeCompare(b.end_date))

  if (sorted.length < 2) {
    // Fallback: no history to average from
    return {
      suggestedEndDate: addDays(today, 30),
      suggestedDueDate: addDays(today, 45),
    }
  }

  // Average cycle length from last 3 pairs
  const pairs = sorted.slice(-4)
  let totalCycleDays = 0
  let totalGapDays = 0
  let count = 0

  for (let i = 1; i < pairs.length; i++) {
    totalCycleDays += daysBetween(pairs[i - 1].end_date, pairs[i].end_date)
    totalGapDays += daysBetween(pairs[i].end_date, pairs[i].due_date)
    count++
  }

  const avgCycleDays = Math.round(totalCycleDays / count)
  const avgGapDays = Math.round(totalGapDays / count)

  const lastEnd = sorted[sorted.length - 1].end_date
  const nextEnd = addDaysToISO(lastEnd, avgCycleDays)
  const nextDue = addDaysToISO(nextEnd, avgGapDays)

  return { suggestedEndDate: nextEnd, suggestedDueDate: nextDue }
}

// ─── Transaction → period assignment ──────────────────────────────────────────

export function assignTransactionToPeriod<P extends CardPeriodWithPayment>(
  periods: P[],
  txDate: string,
): P | null {
  return (
    periods.find(
      (p) => !p.has_payment && p.start_date <= txDate && txDate <= p.end_date,
    ) ?? null
  )
}

// ─── Installments / money arithmetic ──────────────────────────────────────────

export function splitAmountIntoInstallments(amount: number, n: number): Money[] {
  return Money.split(Money.from(amount), n)
}

export function sumMoneyValues(values: Array<number | string>): number {
  const total = values.reduce(
    (acc, value) => Money.add(acc, Money.from(value)),
    Money.from(0),
  )

  return Money.toNumber(total)
}

export function subtractMoneyValues(a: number | string, b: number | string): number {
  return Money.toNumber(Money.subtract(Money.from(a), Money.from(b)))
}

// ─── ISO date arithmetic helpers ──────────────────────────────────────────────

export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysToISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return formatDateISO(date)
}

export function addMonthsToISO(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1 + months, d)
  return formatDateISO(date)
}

function addDays(date: Date, days: number): string {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return formatDateISO(result)
}

function daysBetween(isoA: string, isoB: string): number {
  const [ay, am, ad] = isoA.split('-').map(Number)
  const [by, bm, bd] = isoB.split('-').map(Number)
  const a = new Date(ay, am - 1, ad).getTime()
  const b = new Date(by, bm - 1, bd).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}
