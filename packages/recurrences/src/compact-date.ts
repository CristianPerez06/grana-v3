/**
 * A date as short as a list row can afford: `1 dic`, `15 oct` — and the year
 * only when it is not this year's (`20 ene 2027`), because that is the one case
 * where leaving it out would point at the wrong month.
 *
 * Shared so the hub's rule list says the same thing on web and native. It takes
 * the ISO string apart instead of going through `new Date(iso)`, which parses a
 * bare `YYYY-MM-DD` as UTC and lands on the previous day in AR; and it carries
 * its own month names because `Intl` disagrees across runtimes (`sept` vs
 * `sep`), and two platforms printing the same date differently is the drift
 * this package exists to prevent.
 */

export type CompactDateLocale = 'es' | 'en'

const MONTHS_SHORT: Record<CompactDateLocale, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

export function formatCompactDate(iso: string, today: string, locale: CompactDateLocale): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const month = MONTHS_SHORT[locale][m - 1]
  const dayMonth = locale === 'en' ? `${month} ${d}` : `${d} ${month}`
  return iso.slice(0, 4) === today.slice(0, 4) ? dayMonth : `${dayMonth} ${y}`
}
