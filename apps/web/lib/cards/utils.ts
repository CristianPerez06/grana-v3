import { Money } from '@grana/validation'
import type { CardPeriodWithPayment, PeriodStatus, PeriodVariant } from './types'

// ─── Task 3.1 ─────────────────────────────────────────────────────────────────

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

// ─── Task 3.2 ─────────────────────────────────────────────────────────────────

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

// ─── Task 3.3 ─────────────────────────────────────────────────────────────────

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

// ─── Task 3.4 ─────────────────────────────────────────────────────────────────

export function assignTransactionToPeriod(
  periods: CardPeriodWithPayment[],
  txDate: string,
): CardPeriodWithPayment | null {
  return (
    periods.find(
      (p) => !p.has_payment && p.start_date <= txDate && txDate <= p.end_date,
    ) ?? null
  )
}

// ─── Task 3.5 ─────────────────────────────────────────────────────────────────

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

// ─── Date helpers (ISO string arithmetic, exported for use in actions) ────────

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
