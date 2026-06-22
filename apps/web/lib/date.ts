// Re-exported from `@grana/money-logic` so the AR date helpers live in one
// place across web and mobile. New code can import directly from the package.
import { getTodayAR, formatDateISO } from '@grana/money-logic'

export { getTodayAR, formatDateISO }

/**
 * Parse an ISO `YYYY-MM-DD` accounting date into a **local** `Date` (midnight in
 * the browser's zone). Deliberately avoids `new Date('YYYY-MM-DD')`, which the
 * spec parses as UTC and shifts the day backwards in negative-offset zones (AR).
 * Returns `undefined` for empty/invalid input so callers can render a placeholder.
 */
export function parseISODate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return undefined
  const [, y, mo, d] = m
  return new Date(Number(y), Number(mo) - 1, Number(d))
}

/** Today as an ISO `YYYY-MM-DD` string in the financial timezone (AR). */
export function todayISO(): string {
  return formatDateISO(getTodayAR())
}
