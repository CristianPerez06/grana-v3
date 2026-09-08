// ─── Recurrence frequency primitives ─────────────────────────────────────────

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual'

// Custom recurrences are modelled as a generic interval: `count` units of
// `interval_unit`. The four named frequencies above are presets of this same
// model (see presetToInterval), so date math has a single code path.
export type IntervalUnit = 'day' | 'week' | 'month' | 'year'

function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return formatDateISO(date)
}

function addMonthsClamped(
  isoDate: string,
  monthsToAdd: number,
  options: { anchorDate?: string } = {},
): string {
  const date = parseISODate(isoDate)
  const sourceDay = options.anchorDate ? parseISODate(options.anchorDate).getDate() : date.getDate()
  const targetMonthIndex = date.getMonth() + monthsToAdd
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12)
  const normalizedTargetMonth = ((targetMonthIndex % 12) + 12) % 12
  const targetDay = Math.min(sourceDay, daysInMonth(targetYear, normalizedTargetMonth))

  return formatDateISO(new Date(targetYear, normalizedTargetMonth, targetDay))
}

// Resolve a named frequency preset to its (count, unit) interval. This is the
// single source of truth that keeps presets and custom intervals on one path.
export function presetToInterval(frequency: RecurrenceFrequency): {
  count: number
  unit: IntervalUnit
} {
  switch (frequency) {
    case 'weekly':
      return { count: 1, unit: 'week' }
    case 'biweekly':
      return { count: 2, unit: 'week' }
    case 'monthly':
      return { count: 1, unit: 'month' }
    case 'annual':
      return { count: 1, unit: 'year' }
  }
}

// Advance a date by `count` units of `unit`. month/year apply end-of-month
// clamping (31-Jan + 1 month → 28/29-Feb); week/day are plain day arithmetic.
export function addInterval(
  fromDate: string,
  unit: IntervalUnit,
  count: number,
  options: { anchorDate?: string } = {},
): string {
  if (unit === 'day') return addDays(fromDate, count)
  if (unit === 'week') return addDays(fromDate, count * 7)
  if (unit === 'month') return addMonthsClamped(fromDate, count, options)
  return addMonthsClamped(fromDate, count * 12, options) // 'year'
}

export function getNextRecurrenceDate(
  fromDate: string,
  frequency: RecurrenceFrequency,
  options: { anchorDate?: string } = {},
): string {
  const { count, unit } = presetToInterval(frequency)
  return addInterval(fromDate, unit, count, options)
}

// ─── Generator decision (pure) ───────────────────────────────────────────────
//
// Given a rule, today's date, and whether a pending instance already exists,
// decide whether the generator should create a new pending instance for this
// rule, and if so, with which scheduled_date.
//
// Extracted from generateDueRecurrenceInstances so it can be tested without
// hitting the database. The generator wraps this with the DB fetch/insert.

export type RuleForDecision = {
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  // Authoritative interval. When present it drives the calculation; `frequency`
  // is kept as a backward-compatible fallback for callers that only carry the
  // preset label.
  interval_count?: number
  interval_unit?: IntervalUnit
  frequency?: RecurrenceFrequency
  // Optional cap on how many occurrences the rule ever produces.
  max_occurrences?: number | null
}

export type GenerationDecision =
  | {
      generate: false
      reason: 'has_pending' | 'not_due' | 'past_end_date' | 'max_occurrences_reached'
    }
  | { generate: true; scheduled_date: string }

export function decideRecurrenceInstance(
  rule: RuleForDecision,
  today: string,
  hasPending: boolean,
): GenerationDecision {
  // 1. Skip if there's already a pending instance for this rule. The DB-level
  //    UNIQUE INDEX recurrence_instances_one_pending_per_rule enforces this
  //    invariant; we also short-circuit it here to avoid useless inserts.
  if (hasPending) return { generate: false, reason: 'has_pending' }

  // 2. Compute the next occurrence anchored to start_date so the day-of-month
  //    is preserved across short months (e.g. monthly rule starting on 31
  //    becomes 28/29 in February but goes back to 31 the next month).
  const { count, unit } =
    rule.interval_count != null && rule.interval_unit != null
      ? { count: rule.interval_count, unit: rule.interval_unit }
      : presetToInterval(rule.frequency ?? 'monthly')
  // The same calendar the projection and the "próximo" walk. `max_occurrences`
  // is deliberately left out: the cap is applied below, against the ordinal,
  // and a capped schedule would make the ordinal lookup stop short of the very
  // date we are asking about.
  const schedule: OccurrenceSchedule = {
    start_date: rule.start_date,
    end_date: rule.end_date,
    interval_count: count,
    interval_unit: unit,
    max_occurrences: null,
  }
  // First instance of a directly-created rule (no seed transaction): when
  // last_generated_date is null, the first occurrence falls ON start_date — we
  // do NOT add an interval. Rules created from a movement or a suggestion carry
  // a non-null last_generated_date (the seed already covers start_date), so they
  // advance by one interval as before.
  const nextDate =
    rule.last_generated_date == null
      ? rule.start_date
      : addInterval(rule.last_generated_date, unit, count, {
          anchorDate: rule.start_date,
        })

  // 3. If the next date is still in the future, nothing to do yet.
  if (nextDate > today) return { generate: false, reason: 'not_due' }

  // 4. If the rule has an end_date and we've moved past it, the rule is
  //    finished — no more instances generated. Status remains 'active' in DB
  //    (the UI labels it "Finalizada" by comparing today vs end_date).
  if (rule.end_date != null && nextDate > rule.end_date) {
    return { generate: false, reason: 'past_end_date' }
  }

  // 5. Stop once the rule has produced its maximum number of occurrences. The
  //    cap is counted ON THE CALENDAR — `nextDate`'s own ordinal from
  //    `start_date` — and NOT by counting rows in `recurrence_instances`.
  //
  //    Counting rows gave the cap a different meaning on every surface, because
  //    an occurrence can exist without a row: a rule created from a movement is
  //    seeded by that movement, which covers `start_date` and materializes no
  //    instance. So with a cap of 3, the row count reached 3 only after three
  //    MORE occurrences, and the rule produced four in total — while the
  //    projection and the "próximo", which both walk the calendar, stopped at
  //    three. The extra one appeared as a pending instance on a date the
  //    projection had never announced.
  //
  //    The ordinal is the single number. It does not depend on what the user
  //    resolved, on what a client wrote, or on rows being deleted.
  if (
    rule.max_occurrences != null &&
    occurrenceOrdinal(schedule, nextDate) > rule.max_occurrences
  ) {
    return { generate: false, reason: 'max_occurrences_reached' }
  }

  return { generate: true, scheduled_date: nextDate }
}

// ── Upcoming projection (pure) ───────────────────────────────────────────────
//
// Project the next occurrences of a set of active rules within a date window,
// WITHOUT touching the database or generating instances. Used by the recurring
// screen's "next 7 days / later this month" informational cards. Amounts are
// NOT summed (bimoneda invariant): each occurrence carries its own currency.

// The schedule of a rule: everything needed to walk its calendar, and nothing
// else. Both the "próximo" calculation and the window projection take this.
export type OccurrenceSchedule = {
  start_date: string
  end_date: string | null
  interval_count: number
  interval_unit: IntervalUnit
  max_occurrences: number | null
}

export type RuleForProjection = OccurrenceSchedule & {
  id: string
  // Cursor of the last occurrence already materialized — by the seed movement
  // that created the rule, or by an instance the user confirmed/omitted. Every
  // projection MUST honor it (see walkOccurrences).
  last_generated_date: string | null
}

export type ProjectedOccurrence = {
  rule_id: string
  scheduled_date: string
}

// Safety net, no longer the thing that decides how far a rule can reach: the
// walker positions itself at the window's edge by arithmetic, so this bounds the
// steps taken INSIDE the window, not the life of the rule. See occurrenceIndexAt.
const MAX_WALK_STEPS = 750

export type OccurrenceWindow = {
  /** Inclusive lower bound. Occurrences before it are stepped over, not emitted. */
  from: string
  /** Inclusive upper bound. Omit for an open-ended walk (bounded by MAX_WALK_STEPS). */
  to?: string | null
  /**
   * Occurrences on or before this date are already materialized — by the rule's
   * seed movement, or by an instance the user confirmed/omitted. They are NOT
   * emitted: announcing one as upcoming would double-count a movement that
   * already exists. Null for a rule with nothing materialized yet.
   *
   * A pending-but-unconfirmed instance does NOT advance the cursor, so its date
   * is intentionally still emitted — it lives in the "por confirmar" surfaces
   * AND in the projection until the user resolves it.
   */
  cursor?: string | null
  /** Stop after this many emitted occurrences. Use 1 to ask "the next one". */
  limit?: number
}

// The n-th occurrence of a schedule, counting start_date as n = 0.
//
// Closed form, NOT n steps: `addInterval` anchors month/year clamping to
// start_date, so stepping k times by `count` months and jumping `k * count`
// months in one go give the same date — the clamping never accumulates drift.
// That equivalence is what lets the walker skip ahead instead of crawling.
export function occurrenceAt(schedule: OccurrenceSchedule, n: number): string {
  const { interval_unit: unit, interval_count: count, start_date: start } = schedule
  if (n <= 0) return start
  if (unit === 'day') return addDays(start, n * count)
  if (unit === 'week') return addDays(start, n * count * 7)
  if (unit === 'month') return addMonthsClamped(start, n * count, { anchorDate: start })
  return addMonthsClamped(start, n * count * 12, { anchorDate: start })
}

// Smallest n such that occurrenceAt(n) satisfies `predicate` against `date` —
// the position of the window's edge, found by arithmetic instead of by walking.
//
// This is the fix for the 750-step ceiling: a daily rule started three years ago
// used to exhaust the cap ~347 days BEFORE a 12-month horizon, so the generator
// never even reached today's occurrence. Now the walk starts at the edge.
//
// The estimate is exact for day/week and off by at most one step for
// month/year (end-of-month clamping), so a bounded correction closes it.
function occurrenceIndexAt(
  schedule: OccurrenceSchedule,
  date: string,
  mode: 'on-or-after' | 'strictly-after',
): number {
  const { interval_unit: unit, interval_count: count, start_date: start } = schedule
  const satisfies = (candidate: string) =>
    mode === 'on-or-after' ? candidate >= date : candidate > date

  let n: number
  if (unit === 'day' || unit === 'week') {
    const step = unit === 'day' ? count : count * 7
    n = Math.floor(daysBetween(start, date) / step)
  } else {
    const monthsPerStep = unit === 'month' ? count : count * 12
    const [sy, sm] = start.split('-').map(Number)
    const [dy, dm] = date.split('-').map(Number)
    n = Math.floor(((dy - sy) * 12 + (dm - sm)) / monthsPerStep)
  }
  if (n < 0) n = 0

  // Walk back while the estimate overshot, then forward until it satisfies.
  // Both loops are bounded: the estimate is never more than a couple of steps off.
  while (n > 0 && satisfies(occurrenceAt(schedule, n - 1))) n -= 1
  while (!satisfies(occurrenceAt(schedule, n))) {
    n += 1
    if (n > MAX_WALK_STEPS) break
  }
  return n
}

// Which occurrence of the schedule `date` is, counting `start_date` as the 1st.
// A date that is not itself on the schedule takes the ordinal of the next
// occurrence on or after it.
//
// This is what `max_occurrences` counts. Expressing the cap as an ordinal — a
// property of the calendar alone — is what keeps the generator, the projection
// and the "próximo" agreeing on how many occurrences a rule has: the number
// cannot drift with what got materialized, resolved or deleted.
export function occurrenceOrdinal(schedule: OccurrenceSchedule, date: string): number {
  return occurrenceIndexAt(schedule, date, 'on-or-after') + 1
}

// THE calendar walker. Every question about when a rule fires — the next
// expected occurrence, the ones inside a window, the generator's own decision —
// resolves through this single function, so the answers cannot diverge.
//
// Steps by the rule's interval anchored to start_date (so end-of-month clamping
// restores the original day: 31-jan → 28-feb → 31-mar). Honors end_date and
// max_occurrences, where max_occurrences counts occurrences from start_date, not
// emitted ones.
//
// It does NOT crawl from start_date: it jumps to the first occurrence that could
// be emitted and walks from there, so a rule that started years ago costs the
// same as one that started last month.
export function walkOccurrences(
  schedule: OccurrenceSchedule,
  window: OccurrenceWindow,
): string[] {
  const { from, to = null, cursor = null, limit } = window
  const out: string[] = []

  // Position at the window's edge: the first occurrence that is both >= `from`
  // and strictly after the cursor. `produced` keeps counting from start_date,
  // because that is what max_occurrences means.
  let produced = occurrenceIndexAt(schedule, from, 'on-or-after')
  if (cursor != null) {
    produced = Math.max(produced, occurrenceIndexAt(schedule, cursor, 'strictly-after'))
  }

  let current = occurrenceAt(schedule, produced)

  for (let steps = 0; steps < MAX_WALK_STEPS; steps++) {
    if (schedule.max_occurrences != null && produced >= schedule.max_occurrences) break
    if (to != null && current > to) break
    if (schedule.end_date != null && current > schedule.end_date) break

    // Positioning already guaranteed both conditions; they stay as an assertion
    // of the contract for callers that pass an edge case we did not foresee.
    if (current >= from && (cursor == null || current > cursor)) {
      out.push(current)
      if (limit != null && out.length >= limit) break
    }

    produced += 1
    current = occurrenceAt(schedule, produced)
  }

  return out
}

// All occurrences of one rule whose date is within [windowStart, windowEnd]
// (inclusive) and that the generator can still produce. An occurrence already
// covered by a real movement (the rule's seed, or a confirmed instance) is NOT
// returned: drawing it as upcoming would announce a gasto the user already has.
export function projectRuleOccurrences(
  rule: RuleForProjection,
  windowStart: string,
  windowEnd: string,
): string[] {
  return walkOccurrences(rule, {
    from: windowStart,
    to: windowEnd,
    cursor: rule.last_generated_date,
  })
}

// The next occurrence a rule is still expected to produce — the calendar
// "próximo" for display. The earliest occurrence that is BOTH:
//   (a) on or after `today` — never surface a past date as "próximo"; and
//   (b) strictly after `lastGeneratedDate` — the cursor of the last occurrence
//       already confirmed/omitted (advanced by confirm & skip). Without (b), a
//       rule whose occurrence for *today* was already confirmed would still show
//       today as "próximo" instead of rolling to the next interval.
// Returns null when the rule has no further occurrence (finished or capped out).
export function getNextExpectedOccurrence(
  rule: OccurrenceSchedule,
  today: string,
  lastGeneratedDate: string | null,
): string | null {
  const [next] = walkOccurrences(rule, {
    from: today,
    cursor: lastGeneratedDate,
    limit: 1,
  })
  return next ?? null
}

// Flatten every rule's in-window occurrences into a single date-sorted list.
export function projectUpcomingOccurrences(
  rules: RuleForProjection[],
  windowStart: string,
  windowEnd: string,
): ProjectedOccurrence[] {
  const all: ProjectedOccurrence[] = []
  for (const rule of rules) {
    for (const date of projectRuleOccurrences(rule, windowStart, windowEnd)) {
      all.push({ rule_id: rule.id, scheduled_date: date })
    }
  }
  all.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  return all
}

// ─── Suggestion detection (pure) ─────────────────────────────────────────────
//
// Detect recurrence candidates from a flat list of recent movements. No DB
// access here — the caller fetches the inputs and decides what to do with the
// output (render a banner, persist a dismissal, etc.).

export type SuggestionMovement = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
  amount: number
  date: string // ISO YYYY-MM-DD
  description: string | null
}

export type RecurrenceSuggestion = {
  fingerprint: string
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
  amount: number
  frequency: RecurrenceFrequency
  start_date: string
  description: string | null
  occurrence_count: number
  /** Most-recent date observed, used to break ties between candidates. */
  last_seen_date: string
}

const FREQUENCY_RANGES: Record<RecurrenceFrequency, [number, number]> = {
  weekly: [5, 9],
  biweekly: [11, 17],
  monthly: [27, 32],
  annual: [355, 375],
}

const FREQUENCY_PRIORITY: RecurrenceFrequency[] = [
  'monthly',
  'biweekly',
  'weekly',
  'annual',
]

function streamKey(movement: SuggestionMovement): string {
  const second =
    movement.type === 'transfer'
      ? `dest:${movement.destination_account_id ?? ''}`
      : `cat:${movement.category_id ?? ''}`
  return `${movement.type}|${movement.account_id}|${second}|${movement.currency_code}`
}

function ruleKeyForExistingRule(rule: {
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
}): string {
  const second =
    rule.movement_type === 'transfer'
      ? `dest:${rule.destination_account_id ?? ''}`
      : `cat:${rule.category_id ?? ''}`
  return `${rule.movement_type}|${rule.account_id}|${second}|${rule.currency_code}`
}

function daysBetween(isoA: string, isoB: string): number {
  const [yA, mA, dA] = isoA.split('-').map(Number)
  const [yB, mB, dB] = isoB.split('-').map(Number)
  const a = Date.UTC(yA, mA - 1, dA)
  const b = Date.UTC(yB, mB - 1, dB)
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function detectFrequency(gaps: number[]): RecurrenceFrequency | null {
  if (gaps.length < 2) return null

  const matches: Record<RecurrenceFrequency, number> = {
    weekly: 0,
    biweekly: 0,
    monthly: 0,
    annual: 0,
  }

  for (const gap of gaps) {
    for (const freq of FREQUENCY_PRIORITY) {
      const [min, max] = FREQUENCY_RANGES[freq]
      if (gap >= min && gap <= max) {
        matches[freq] += 1
        break
      }
    }
  }

  let best: { freq: RecurrenceFrequency | null; count: number } = {
    freq: null,
    count: 0,
  }
  for (const freq of FREQUENCY_PRIORITY) {
    if (matches[freq] > best.count) {
      best = { freq, count: matches[freq] }
    }
  }
  return best.count >= 2 ? best.freq : null
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function buildFingerprint(
  suggestion: Omit<
    RecurrenceSuggestion,
    'fingerprint' | 'amount' | 'start_date' | 'description' | 'occurrence_count' | 'last_seen_date'
  >,
): string {
  const second =
    suggestion.movement_type === 'transfer'
      ? `dest:${suggestion.destination_account_id ?? ''}`
      : `cat:${suggestion.category_id ?? ''}`
  return `${suggestion.movement_type}|${suggestion.account_id}|${second}|${suggestion.currency_code}|${suggestion.frequency}`
}

export type ExistingRuleStream = Parameters<typeof ruleKeyForExistingRule>[0]

export function detectRecurrenceSuggestions(
  movements: SuggestionMovement[],
  dismissedFingerprints: Set<string>,
  existingRules: ExistingRuleStream[],
): RecurrenceSuggestion[] {
  const existingStreamKeys = new Set(existingRules.map(ruleKeyForExistingRule))

  const streams = new Map<string, SuggestionMovement[]>()
  for (const movement of movements) {
    if (movement.type === 'transfer' && !movement.destination_account_id) {
      continue
    }
    if (movement.type !== 'transfer' && !movement.category_id) {
      continue
    }
    const key = streamKey(movement)
    if (existingStreamKeys.has(key)) continue
    const bucket = streams.get(key) ?? []
    bucket.push(movement)
    streams.set(key, bucket)
  }

  const suggestions: RecurrenceSuggestion[] = []

  for (const bucket of streams.values()) {
    if (bucket.length < 3) continue

    const sorted = [...bucket].sort((a, b) => a.date.localeCompare(b.date))

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }

    const frequency = detectFrequency(gaps)
    if (!frequency) continue

    const sample = sorted[0]
    const amountValue = median(sorted.map((m) => m.amount))
    const latest = sorted[sorted.length - 1]

    const fingerprintBase = {
      movement_type: sample.type,
      account_id: sample.account_id,
      destination_account_id: sample.destination_account_id,
      category_id: sample.category_id,
      currency_code: sample.currency_code,
      frequency,
    }
    const fingerprint = buildFingerprint(fingerprintBase)
    if (dismissedFingerprints.has(fingerprint)) continue

    suggestions.push({
      fingerprint,
      movement_type: sample.type,
      account_id: sample.account_id,
      destination_account_id: sample.destination_account_id,
      category_id: sample.category_id,
      currency_code: sample.currency_code,
      amount: Math.round(amountValue * 100) / 100,
      frequency,
      start_date: latest.date,
      description: latest.description,
      occurrence_count: sorted.length,
      last_seen_date: latest.date,
    })
  }

  // Strongest first: more occurrences, then more recent activity.
  suggestions.sort((a, b) => {
    if (b.occurrence_count !== a.occurrence_count) {
      return b.occurrence_count - a.occurrence_count
    }
    return b.last_seen_date.localeCompare(a.last_seen_date)
  })

  return suggestions
}
