/**
 * The dashboard header's date line ("Martes, 1 de septiembre").
 *
 * `shortMonth` trims the month name to three letters ("Martes, 1 de sep"). At a
 * phone width the line shares its row with the month selector and the eye
 * toggle, and the full month name pushed it onto a second row — two rows of
 * chrome for one date, on the viewport where vertical room is scarcest. Three
 * letters is the same trade the month selector already makes beside it.
 *
 * Locale-agnostic by construction: the month is located by formatting it on its
 * own and replacing that exact substring, so nothing is assumed about where in
 * the pattern it falls ("Tuesday, September 1" → "Tuesday, Sep 1"). If the
 * standalone name does not appear in the full string the replace is a no-op and
 * the caller gets the full line — degraded, never wrong.
 */
export function formatTodayLine(
  todayISO: string,
  localeCode: string,
  options: { shortMonth?: boolean } = {},
): string {
  const [year, month, day] = todayISO.split('-').map(Number)
  const date = new Date(year!, month! - 1, day!)

  const full = date.toLocaleDateString(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const text = options.shortMonth ? withShortMonth(full, date, localeCode) : full
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function withShortMonth(full: string, date: Date, localeCode: string): string {
  const monthName = date.toLocaleDateString(localeCode, { month: 'long' })
  if (monthName.length <= 3) return full
  return full.replace(monthName, monthName.slice(0, 3))
}
