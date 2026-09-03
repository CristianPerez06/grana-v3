/**
 * The dashboard header's date line ("Martes, 1 de septiembre").
 *
 * `short` trims BOTH the weekday and the month to three letters ("Mar, 1 de
 * sep"). At a phone width the line shares its row with the month selector and
 * the eye toggle, which take ~190px of a ~330px row and leave the date ~125px.
 *
 * The month alone is not enough of a trim. "Martes, 1 de sep" is 92px and fits;
 * "Miércoles, 2 de sep" is 109px and does not, so the line truncated every
 * Wednesday and Sunday — the two longest weekday names in Spanish. Whatever is
 * trimmed has to be trimmed for the LONGEST day of the week, not for the day
 * the change happened to be written on.
 *
 * Locale-agnostic by construction: each part is located by formatting it on its
 * own and replacing that exact substring, so nothing is assumed about where in
 * the pattern it falls ("Wednesday, September 2" → "Wed, Sep 2"). If a
 * standalone name does not appear in the full string the replace is a no-op and
 * the caller gets that part in full — degraded, never wrong.
 */
export function formatTodayLine(
  todayISO: string,
  localeCode: string,
  options: { short?: boolean } = {},
): string {
  const [year, month, day] = todayISO.split('-').map(Number)
  const date = new Date(year!, month! - 1, day!)

  const full = date.toLocaleDateString(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const text = options.short
    ? trimPart(trimPart(full, date, localeCode, 'month'), date, localeCode, 'weekday')
    : full

  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Replaces one named part of the formatted line with its first three letters. */
function trimPart(
  line: string,
  date: Date,
  localeCode: string,
  part: 'month' | 'weekday',
): string {
  const name = date.toLocaleDateString(localeCode, { [part]: 'long' })
  if (name.length <= 3) return line
  return line.replace(name, name.slice(0, 3))
}
