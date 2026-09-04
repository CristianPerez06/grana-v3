export type MonthSelection = { year: number; month: number }

/** Is the selected month the one `todayISO` falls in? */
export function isCurrentMonth(todayISO: string, selected: MonthSelection): boolean {
  const [year, month] = todayISO.split('-').map(Number)
  return selected.year === year && selected.month === month
}

/**
 * The dashboard header's date line, as the variants a platform may render —
 * longest first.
 *
 * The line is the month lens, so its text says where the dashboard is being
 * looked at FROM. Standing on the current month it names today, because the
 * balance is today's; standing anywhere else it names that month, because the
 * balance is cut at its close. What "cut at its close" means is said by the
 * balance card's own label, not here — saying it twice does not fit.
 *
 * This function does NOT measure. Measuring text is platform-specific
 * (`measureText` on web, `onTextLayout` on native) and a pure function in a
 * package cannot do it without coupling to one of them. So the rule for WHICH
 * variants exist, and in what order, lives here and is testable without a DOM;
 * picking the first that fits belongs to the caller, which is the only side
 * that can measure. Below the last variant the caller truncates with an
 * ellipsis — one line or an ellipsis, never a paragraph.
 *
 * Standing on another month there is a single variant: "Agosto 2026" has
 * nothing left to drop that would not make it ambiguous.
 *
 * Locale-agnostic by construction: the weekday is located by formatting it on
 * its own and removing that exact substring, so nothing is assumed about where
 * in the pattern it falls ("Wednesday, September 2" → "September 2"). If the
 * standalone name does not appear, the variant is skipped rather than mangled.
 */
export function dateLineVariants(
  todayISO: string,
  localeCode: string,
  selected: MonthSelection,
): string[] {
  if (!isCurrentMonth(todayISO, selected)) {
    return [capitalize(monthAndYear(selected, localeCode))]
  }

  const [year, month, day] = todayISO.split('-').map(Number)
  const date = new Date(year!, month! - 1, day!)

  const full = date.toLocaleDateString(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const withoutWeekday = date.toLocaleDateString(localeCode, {
    day: 'numeric',
    month: 'long',
  })

  // The weekday is the first thing to go: the day number already carries the
  // date, so dropping the name loses the least of what the line is for.
  const variants = [full]
  if (withoutWeekday !== full) variants.push(withoutWeekday)

  return variants.map(capitalize)
}

/** "Agosto 2026" — the month a non-current selection stands on. */
export function monthAndYear(selected: MonthSelection, localeCode: string): string {
  const name = new Date(selected.year, selected.month - 1, 1).toLocaleDateString(localeCode, {
    month: 'long',
  })
  return `${capitalize(name)} ${selected.year}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
