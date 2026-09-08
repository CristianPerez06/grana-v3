import type { MonthSelection } from './date-line'

/** How far back the dashboard's month lens reaches, in months before today. */
export const MONTHS_BACK = 12

export type ReachableMonth = MonthSelection & {
  /** Short label in the caller's locale ("Sep"), so both platforms read alike. */
  label: string
  /** Within `MONTHS_BACK` of today and not in the future. */
  reachable: boolean
}

export type MonthYear = {
  year: number
  /** The full calendar year, January first. */
  months: ReachableMonth[]
}

/**
 * The months the lens can stand on, grouped by calendar year, newest year
 * first.
 *
 * Every month of each spanned year is returned, including the ones out of
 * range, flagged `reachable: false`. That is deliberate: the sheet renders them
 * visible but disabled so the rule — nothing in the future, twelve months back
 * — is SEEN, instead of being discovered by tapping a control that does
 * nothing. Dropping them would leave a ragged grid that explains nothing.
 *
 * Thirteen consecutive months always span exactly two calendar years, but the
 * range is derived rather than assumed, so a change to `MONTHS_BACK` needs no
 * edit here.
 */
export function reachableMonths(todayISO: string, localeCode: string): MonthYear[] {
  const [todayYear, todayMonth] = todayISO.split('-').map(Number)
  const oldest = shift({ year: todayYear!, month: todayMonth! }, -MONTHS_BACK)

  const years: MonthYear[] = []
  for (let year = todayYear!; year >= oldest.year; year--) {
    years.push({
      year,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        return {
          year,
          month,
          label: shortLabel(year, month, localeCode),
          reachable: isReachable({ year, month }, oldest, { year: todayYear!, month: todayMonth! }),
        }
      }),
    })
  }
  return years
}

/** Is `candidate` inside the closed range [oldest, today]? */
function isReachable(
  candidate: MonthSelection,
  oldest: MonthSelection,
  today: MonthSelection,
): boolean {
  return ordinal(candidate) >= ordinal(oldest) && ordinal(candidate) <= ordinal(today)
}

/** Months since year 0 — makes range checks plain comparisons. */
function ordinal({ year, month }: MonthSelection): number {
  return year * 12 + (month - 1)
}

function shift({ year, month }: MonthSelection, months: number): MonthSelection {
  const total = ordinal({ year, month }) + months
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

function shortLabel(year: number, month: number, localeCode: string): string {
  const name = new Date(year, month - 1, 1).toLocaleDateString(localeCode, { month: 'long' })
  const short = name.slice(0, 3)
  return short.charAt(0).toUpperCase() + short.slice(1)
}
