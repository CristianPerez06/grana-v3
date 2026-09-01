import { financialTodayISO } from '@grana/money-logic'

// ── The committed card's two dates, derived once ──────────────────────────────
//
// The card used to take a single `todayISO` that quietly served two roles: which
// month the window covers, and when "now" is for deciding what is still unpaid.
// They coincided only because the card always looked from today, and collapsing
// them is what kept it from following the month navigator.
//
// They are separated here, and so are the two facts the read branches on. `lens`
// and `windowElapsed` are NOT derivable from each other: the card's two halves
// partition the navigator's positions in different places.
//
//   position          selected month   snapshotDate   lens        windowElapsed
//   ───────────────────────────────────────────────────────────────────────────
//   1  current        this month       today          'live'      false
//   2  previous       last month       its close      'snapshot'  false
//   3  older          any before       its close      'snapshot'  true
//
// Cards split 1 from {2,3}: under `live` the payment state is today's and there
// is an overdue carryover from today; under `snapshot` both are evaluated at the
// cut. Fixed expenses split {1,2} from 3: projecting active rules stays valid
// while the window has not ended, because the `last_generated_date` cursor has
// not passed it yet.
//
// Deriving one field from the other is the bug this file exists to prevent. A
// single `mode` taken from "has the window ended?" reports the current month's
// behaviour on the 1st of September while looking at August — whose window is
// September, still running — and the snapshot at 31/08 gets computed and then
// thrown away.

export type CommittedLens = 'live' | 'snapshot'

export type CommittedWindow = {
  /** The window the card totals: the calendar month AFTER the selected one. */
  window: { start: string; end: string }
  /**
   * When each commitment's state is evaluated: the selected month's last day,
   * or today when the selected month is the current one. Always strictly before
   * `window.start` — the balance card cuts here and this window opens the next
   * day, so the two amounts on screen never overlap.
   */
  snapshotDate: string
  lens: CommittedLens
  /** Whether the window has already ended. Governs the rule projection only. */
  windowElapsed: boolean
}

const iso = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Last calendar day of a 1-based (year, month). */
const lastDayOf = (year: number, month: number): number => new Date(year, month, 0).getDate()

export function resolveCommittedWindow({
  year,
  month,
  todayISO = financialTodayISO(),
}: {
  year: number
  month: number
  todayISO?: string
}): CommittedWindow {
  const [todayYear, todayMonth] = todayISO.split('-').map(Number) as [number, number, number]
  const isCurrentMonth = year === todayYear && month === todayMonth

  // `month` is 1-based, so using it as a 0-based index already names the NEXT
  // month — and rolls the year over on its own for December.
  const windowStartDate = new Date(year, month, 1)
  const windowYear = windowStartDate.getFullYear()
  const windowMonth = windowStartDate.getMonth() + 1

  const window = {
    start: iso(windowYear, windowMonth, 1),
    end: iso(windowYear, windowMonth, lastDayOf(windowYear, windowMonth)),
  }

  return {
    window,
    snapshotDate: isCurrentMonth ? todayISO : iso(year, month, lastDayOf(year, month)),
    lens: isCurrentMonth ? 'live' : 'snapshot',
    windowElapsed: window.end < todayISO,
  }
}
