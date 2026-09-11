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

/**
 * NO LONGER ON THE GENERATOR'S PATH. `generateDueRecurrenceInstances` derives
 * what a rule is owed from `owedOccurrencesForRule` — the whole list, over the
 * rule's schedule versions and pauses — instead of asking for one date at a
 * time. This function survives only as the single-occurrence decision its tests
 * still describe, and it is the last caller of the `hasPending` short-circuit,
 * which is the invariant this change removes. It goes away with its tests
 * rewritten against the walker; see task 1.6.
 */
export function decideRecurrenceInstance(
  rule: RuleForDecision,
  today: string,
  hasPending: boolean,
): GenerationDecision {
  // 1. Skip if there's already a pending instance for this rule. The DB-level
  //    UNIQUE INDEX recurrence_instances_one_pending_per_rule enforces this
  //    invariant; we also short-circuit it here to avoid useless inserts.
  if (hasPending) return { generate: false, reason: 'has_pending' }

  const { count, unit } =
    rule.interval_count != null && rule.interval_unit != null
      ? { count: rule.interval_count, unit: rule.interval_unit }
      : presetToInterval(rule.frequency ?? 'monthly')
  // The rule's calendar, and only the calendar. `end_date` and `max_occurrences`
  // are deliberately left out: both are applied below, with their own reason, and
  // a schedule carrying them would make the walk stop short of the very date we
  // are asking about.
  const schedule: OccurrenceSchedule = {
    start_date: rule.start_date,
    end_date: null,
    interval_count: count,
    interval_unit: unit,
    max_occurrences: null,
    // The calendar, unfloored on purpose: the floor is applied to the RESULT of
    // the walk below, for the same reason `end_date` is left out here.
    schedule_effective_from: null,
  }

  // 2. The next occurrence is READ OFF THE CALENDAR — the first one strictly
  //    after the cursor — and no longer resumed from the cursor with
  //    `addInterval(cursor, …)`.
  //
  //    The two agree whenever the cursor sits on the rule's own schedule, which
  //    the cursor-phase audit measured against production: of 61 rules with a
  //    cursor, ZERO had it off schedule and ZERO produced a different next date.
  //    So this is behaviour-preserving today, and it is the definition that stays
  //    correct tomorrow: the calendar does not depend on WHEN the last occurrence
  //    happened to be resolved, while the cursor does. Migration 0064 re-checks
  //    the same invariant in its own transaction and aborts if it stopped holding
  //    (§4b), so the two can never drift apart silently.
  //
  //    With no cursor the first occurrence falls ON `start_date` — a directly
  //    created rule is owed its own start date — and `walkOccurrences` emits it
  //    because the window opens there and there is nothing to be strictly after.
  //    A rule seeded from a movement carries a cursor on `start_date`, so the
  //    seed is not proposed a second time.
  const [nextDate] = walkOccurrences(schedule, {
    from: rule.start_date,
    cursor: rule.last_generated_date,
    limit: 1,
  })
  if (nextDate == null) return { generate: false, reason: 'not_due' }

  // 3. If the next date is still in the future, nothing to do yet.
  if (nextDate > today) return { generate: false, reason: 'not_due' }

  // 4. If the rule has an end_date and we've moved past it, the rule is
  //    finished — no more instances generated. Status remains 'active' in DB
  //    (the UI labels it "Finalizada" by comparing today vs end_date).
  if (rule.end_date != null && nextDate > rule.end_date) {
    return { generate: false, reason: 'past_end_date' }
  }

  // 5. Stop once the rule has produced its maximum number of occurrences.
  //
  //    The cap is `nextDate`'s own ordinal from `start_date`, and NOT a count of
  //    rows in `recurrence_instances`. Counting rows gave the cap a different
  //    meaning on every surface, because an occurrence can exist without a row: a
  //    rule created from a movement is seeded by that movement, which covers
  //    `start_date` and materializes no instance. With a cap of 3 the row count
  //    reached 3 only after three MORE occurrences, so the rule produced four,
  //    while the projection and the "próximo" — both of which walk the calendar —
  //    stopped at three. The extra one showed up as a pending instance on a date
  //    the projection had never announced.
  //
  //    The ordinal is now the single number, with no fallback behind it: step 2
  //    reads `nextDate` off the calendar, so it is an occurrence by construction
  //    and always has one. There is no longer a case where the cap cannot be read.
  if (rule.max_occurrences != null) {
    const ordinal = occurrenceOrdinal(schedule, nextDate)
    if (ordinal == null || ordinal > rule.max_occurrences) {
      return { generate: false, reason: 'max_occurrences_reached' }
    }
  }

  return { generate: true, scheduled_date: nextDate }
}

// ── The occurrences a rule is owed, over ONE calendar segment (pure) ─────────
//
// THE question the generator has to ask, and the shape it has to be asked in:
// not "is there one more?" but "which ones are missing?".
//
// SCOPE, so this is not mistaken for the whole generator: it resolves a single
// segment — one schedule, the one in force. Composing several of them is what
// historical schedule versions and pause intervals need, and that lives in tasks
// 2.1b and 2.1d, not here.
//
// The old question could only ever be answered once per rule, because the answer
// was derived from a CURSOR that only moved when the user resolved something. A
// rule with one unresolved pending occurrence never advanced it, so the rule
// produced nothing again, ever — that is #96. Deriving the answer from the
// CALENDAR minus WHAT ALREADY EXISTS has no such trap: an unresolved occurrence
// removes its own date from the list and nothing else.
//
// Bounds, and why each one is there:
//
//   reconstructFrom  The floor. Occurrences are emitted STRICTLY AFTER it —
//                    everything up to it the rule already considers covered.
//                    Persisted per rule by migration 0064, which sets it to the
//                    last known point precisely so the migration cannot invent
//                    backlog that may never have existed.
//   horizon          How far back the automatic reconstruction reaches (12
//                    months). It limits the REBUILD, not what the user may
//                    register by hand.
//   today            Nothing in the future is owed yet.
//   existing         The `due_date`s the rule already has, in ANY state —
//                    pending, skipped AND confirmed. What matters is that the
//                    occurrence EXISTS, not how it ended: a pending one is not
//                    created again, and a skipped one does not come back. That is
//                    the whole difference with the cursor, which would also have
//                    blocked every date after it.
//
// `end_date` and `max_occurrences` come in through the schedule and the walker
// honours both: an occurrence past either is not owed.

export type OwedOccurrencesInput = {
  schedule: OccurrenceSchedule
  reconstructFrom: string
  horizon: string
  today: string
  existing: Iterable<string>
}

export function owedOccurrences({
  schedule,
  reconstructFrom,
  horizon,
  today,
  existing,
}: OwedOccurrencesInput): string[] {
  const already = new Set(existing)
  return walkOccurrences(schedule, {
    from: horizon,
    to: today,
    cursor: reconstructFrom,
  }).filter((date) => !already.has(date))
}

// ── What a rule is owed across its WHOLE history ─────────────────────────────
//
// `owedOccurrences` above answers the question for ONE calendar segment. A rule
// does not necessarily have one: its schedule can have been edited, and it can
// have been paused. Both are recorded by migration 0064 —
// `recurrence_schedule_versions` and `recurrence_pauses` — and both change WHICH
// dates the rule ever produced:
//
//   · a schedule version applies only FROM its `effective_from`. Reading today's
//     schedule backwards would read the difference against the old history as
//     gaps and materialize occurrences that never existed (decision 10);
//   · a pause means the rule was not running. Occurrences inside it were never
//     owed and do not come back on resume — pausing is not deferred billing
//     (decision 16).
//
// So the rule's timeline is cut into segments — one per version, minus the pause
// intervals — and each segment is walked with the schedule that actually applied
// there. This is what the floor `reconstruct_from` deliberately does NOT do: it
// stays put so that occurrences hidden by the bug before a pause remain
// reachable, instead of being swallowed by a floor that jumped forward.

export type ScheduleVersion = {
  /** Since when this version applies. Nothing before it is described by it. */
  effective_from: string
  /**
   * The last day, INCLUSIVE, on which this version may produce. `null` means
   * "until the next one starts", which is how every version read before #121.
   *
   * It exists because the end of a version could only be DERIVED from the start
   * of the next, and that made a GAP inexpressible — the stretch where a rule's
   * old schedule has stopped and the new one has not begun. Without it,
   * correcting an anchor to rule from next month left the old schedule firing
   * one more time in between, on the old date: the same duplicate, one cycle
   * later.
   */
  effective_until?: string | null
  interval_count: number
  interval_unit: IntervalUnit
  /**
   * Anchor for end-of-month clamping AND origin of the version's calendar: it
   * is what makes a rule on the 31st come back to the 31st after February.
   */
  anchor_date: string
}

export type PauseInterval = {
  paused_from: string
  /** Null while the pause is still open. */
  resumed_at: string | null
}

export type OwedOccurrencesForRuleInput = {
  /** At least one; any order. Empty means the rule has no known schedule. */
  versions: ScheduleVersion[]
  pauses: PauseInterval[]
  endDate: string | null
  maxOccurrences: number | null
  reconstructFrom: string
  horizon: string
  today: string
  existing: Iterable<string>
  /**
   * The occurrence the rule's seed movement covers, or null when it had none.
   *
   * It is a SPENT POSITION from the moment the rule exists — the movement is in
   * the ledger, dated ahead or not — and no version of the schedule need produce
   * it for that to be true. Correcting a reference date is exactly the case
   * where none does: the seed's own date falls in the gap the correction opens,
   * nothing walks it, nothing counts it, and a three-cuota rule generates three
   * more on top of the movement the user already has.
   */
  seedOccurrenceDate: string | null
}

// A pause covers [paused_from, resumed_at): the day it is resumed the rule is
// running again, and an occurrence falling on it is owed. An occurrence on
// `paused_from` itself is NOT — it belongs to the pause, and one that was owed
// before pausing sits at an earlier date and survives untouched, which is what
// keeps pre-pause occurrences resolvable.
function subtractPauses(
  segments: Array<{ from: string; to: string }>,
  pauses: PauseInterval[],
): Array<{ from: string; to: string }> {
  let out = segments
  for (const pause of pauses) {
    const next: Array<{ from: string; to: string }> = []
    for (const segment of out) {
      const pauseEnd = pause.resumed_at == null ? null : addDays(pause.resumed_at, -1)
      // No overlap: the segment ends before the pause starts, or starts after it ends.
      if (segment.to < pause.paused_from || (pauseEnd != null && segment.from > pauseEnd)) {
        next.push(segment)
        continue
      }
      if (segment.from < pause.paused_from) {
        next.push({ from: segment.from, to: addDays(pause.paused_from, -1) })
      }
      if (pauseEnd != null && segment.to > pauseEnd) {
        next.push({ from: addDays(pauseEnd, 1), to: segment.to })
      }
    }
    out = next
  }
  return out
}

/**
 * THE COMPOSED WALK, once.
 *
 * Two questions run over the same timeline: which occurrences a rule still owes,
 * and how many positions of its calendar it has already spent. They must not be
 * answered by two loops — `max_occurrences` counts POSITIONS, so a second
 * implementation that counted anything else (materialized rows, say) would let
 * the cap mean one thing to the generator and another to the form offering
 * dates. So the walk lives here and both callers pass through it.
 *
 * `visit` sees every date the rule produces, in order, already counted. Returns
 * how many positions were spent in total.
 */
function forEachComposedOccurrence(
  {
    versions,
    pauses,
    endDate,
    maxOccurrences,
    horizon,
    today,
    seedOccurrenceDate,
  }: Omit<OwedOccurrencesForRuleInput, 'reconstructFrom' | 'existing'>,
  visit: (date: string) => void,
): number {
  if (versions.length === 0) return seedOccurrenceDate == null ? 0 : 1

  const ordered = [...versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from))

  // Is the seed's own position already inside the arithmetic prefix the first
  // version contributes? If it is, it is counted there and must not be counted
  // again; if it is not, it is counted UP FRONT — before the cap is consulted —
  // because whether some version happens to walk over it is not what decides
  // that the money is committed.
  const firstVersion = ordered[0]
  const seedInFirstPrefix =
    seedOccurrenceDate != null &&
    seedOccurrenceDate < firstVersion.effective_from &&
    occurrenceOrdinal(
      {
        start_date: firstVersion.anchor_date,
        end_date: endDate,
        interval_count: firstVersion.interval_count,
        interval_unit: firstVersion.interval_unit,
        max_occurrences: null,
        schedule_effective_from: null,
      },
      seedOccurrenceDate,
    ) != null
  const seedCountedUpFront = seedOccurrenceDate != null && !seedInFirstPrefix

  // How many occurrences the rule has produced SO FAR along its composed
  // timeline. `max_occurrences` counts positions on the rule's calendar from its
  // start — one number for the whole rule, not one per schedule version. Handing
  // the cap to each version's walk separately let a rule edited from monthly to
  // biweekly produce the cap TWICE, which for a 6-cuota purchase means 12 cuotas.
  let produced = 0

  for (const [index, version] of ordered.entries()) {
    if (maxOccurrences != null && produced >= maxOccurrences) break

    const schedule: OccurrenceSchedule = {
      // The version's calendar origin, NOT the rule's start_date: it is what
      // fixes the phase and the clamping anchor of the dates this version
      // produced.
      start_date: version.anchor_date,
      end_date: endDate,
      // A version already states the stretch it rules (`effective_from` ..
      // `effective_until`), which is bounded below. The column-level floor is
      // what the readers WITHOUT versions use instead; here it would be a second
      // bound on the same thing.
      schedule_effective_from: null,
      interval_count: version.interval_count,
      interval_unit: version.interval_unit,
      // Deliberately null: the cap is applied against `produced` below, across
      // every version. Leaving it here would restart the count on each one.
      max_occurrences: null,
    }

    // The stretch this version owns: from where it takes effect until the next
    // one does, never past today.
    const nextVersion = ordered[index + 1]
    // The EARLIEST of the three things that can end a version: its own explicit
    // end, the start of the next one, and today. Taking the minimum is what makes
    // a gap possible — an explicit end before the next version starts produces a
    // stretch nobody describes, and nothing owed inside it.
    const bounds = [today]
    if (version.effective_until != null) bounds.push(version.effective_until)
    if (nextVersion != null) bounds.push(addDays(nextVersion.effective_from, -1))
    const to = bounds.reduce((earliest, bound) => (bound < earliest ? bound : earliest))

    // The first version's calendar reaches back to its anchor, and the
    // occurrences between the anchor and `effective_from` are the ones the cap
    // has already spent — the assumed version claims the schedule applied there.
    // Counting them by arithmetic costs nothing and is exactly what
    // `walkOccurrences` did when the cap lived in the schedule.
    if (index === 0) {
      produced =
        occurrenceIndexAt(schedule, version.effective_from, 'on-or-after') +
        (seedCountedUpFront ? 1 : 0)
    }

    // Where the walk STARTS. With a cap it must start where the version does,
    // because occurrences before the horizon still spend it. Without one,
    // clipping to the horizon is a pure saving that cannot change the answer:
    // nothing before it is ever owed and there is no ordinal to keep.
    const walkFrom =
      maxOccurrences != null || version.effective_from > horizon
        ? version.effective_from
        : horizon
    if (walkFrom > to) continue

    for (const segment of subtractPauses([{ from: walkFrom, to }], pauses)) {
      const remaining = maxOccurrences == null ? undefined : maxOccurrences - produced
      if (remaining != null && remaining <= 0) break

      // The budget this segment actually needs, by the same arithmetic that
      // positions the walk. Without it a rule whose life outruns the default — a
      // daily rule running for years — stopped at 750 and reported fewer
      // positions spent than it had, which reads as a cap still unspent.
      const span =
        occurrenceIndexAt(schedule, segment.to, 'strictly-after') -
        occurrenceIndexAt(schedule, segment.from, 'on-or-after') +
        2

      // One more when the seed's date falls in this stretch: it is emitted like
      // any other, but it was counted up front, so a limit derived from what is
      // left of the cap would stop the walk one occurrence short.
      const seedInSegment =
        seedCountedUpFront &&
        seedOccurrenceDate != null &&
        seedOccurrenceDate >= segment.from &&
        seedOccurrenceDate <= segment.to

      for (const date of walkOccurrences(schedule, {
        from: segment.from,
        to: segment.to,
        limit: remaining == null ? undefined : remaining + (seedInSegment ? 1 : 0),
        maxSteps: Math.max(span, MAX_WALK_STEPS),
      })) {
        // Counted once, and it may already have been.
        if (!(seedCountedUpFront && date === seedOccurrenceDate)) produced += 1
        visit(date)
      }
    }
  }

  return produced
}

export function owedOccurrencesForRule({
  reconstructFrom,
  horizon,
  existing,
  ...walk
}: OwedOccurrencesForRuleInput): string[] {
  const already = new Set(existing)
  const owed: string[] = []

  forEachComposedOccurrence({ ...walk, horizon }, (date) => {
    // The three reasons a date the rule produced is not owed. They are applied
    // AFTER counting, because a date that exists — or that predates the floor or
    // the horizon — still occupies its position on the calendar.
    if (date <= reconstructFrom) return
    if (date < horizon) return
    if (already.has(date)) return
    owed.push(date)
  })

  return owed.sort()
}

/**
 * How many positions of its calendar the rule has already spent, as of `today`.
 *
 * This is what `max_occurrences` counts, and the reason it cannot be answered by
 * counting `recurrence_instances`: a rule created from a movement covers its
 * first occurrence with that movement and has NO row for it, and a position the
 * calendar produced while the rule was not being generated has none either.
 * Counting rows says a 6-cuota rule has cuotas left when it does not, and offers
 * a reference date for a rule that will never fire again.
 *
 * Saturates at the cap, because a walk that reaches it stops there.
 */
export function occurrencePositionsSpent(input: {
  versions: ScheduleVersion[]
  pauses: PauseInterval[]
  endDate: string | null
  maxOccurrences: number | null
  today: string
  /** See `OwedOccurrencesForRuleInput.seedOccurrenceDate`. */
  seedOccurrenceDate: string | null
}): number {
  return forEachComposedOccurrence(
    {
      ...input,
      // Never clip the start: the horizon is the generator's "do not bother
      // looking further back than this", and a position before it is spent all
      // the same.
      horizon: '0001-01-01',
    },
    () => {},
  )
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
  /**
   * Since when the CURRENT schedule rules, when it is not simply "always".
   *
   * The generator reads a rule's schedule from its versions; these two readers —
   * "próxima fecha" and the dashboard projection — read it from the columns
   * above, which describe only the newest version. That was invisible while the
   * newest version always ruled from the past. Correcting an anchor to take
   * effect NEXT cycle opens a stretch where the new schedule does not rule yet
   * and the old one has stopped, and without this floor both readers would
   * announce a date the generator is never going to create.
   *
   * REQUIRED, not optional, and that is the point. Every caller builds this
   * object by hand from a row, and an optional floor is one a caller can forget
   * in silence — which is exactly how two shipped readers lost it (#121). Made
   * required, the compiler names them instead. `null` is the explicit "this
   * schedule has always ruled", and it has to be written out.
   */
  schedule_effective_from: string | null
}

export type RuleForProjection = OccurrenceSchedule & {
  id: string
  /**
   * Every occurrence this rule ALREADY COVERS — build it with
   * `coveredOccurrences`. Projections subtract it, so an occurrence that exists
   * is never announced as upcoming as well.
   *
   * This replaces the `last_generated_date` cursor, which said "everything up to
   * here is covered" and was wrong in both directions. It over-covered, because
   * resolving August moved it past July, which the rule still owed; and it
   * under-covered, because an unresolved occurrence never advanced it, so the
   * projection re-emitted a date that already had a row — the same commitment
   * counted twice, once materialized and once projected, which is #118.
   */
  covered: Iterable<string>
}

/**
 * The occurrences a rule already covers, from the two places that can cover one.
 *
 * There are exactly two, and the second is easy to forget: a rule created from a
 * movement has NO instance row for its first occurrence — the seed transaction
 * itself is that occurrence — so that date is covered even though nothing in
 * `recurrence_instances` says so. The old cursor encoded this implicitly by
 * being set to the seed's date; naming it is what lets the cursor go.
 *
 * WHICH DATE, AND WHY NOT `start_date`. It used to be read off the anchor, which
 * was safe only while the anchor could not move. Correcting a reference date
 * moves it (#121), and then the anchor names an occurrence the seed movement
 * never covered: the rule's FIRST occurrence under the corrected schedule would
 * be marked as already existing and vanish from every projection, while the date
 * the movement really covers would be announced as upcoming. The seed occurrence
 * has its own immutable column for exactly this reason.
 */
export function coveredOccurrences(input: {
  /**
   * The occurrence the seed movement covers, or null when the rule was not
   * seeded. NOT the anchor — see above.
   */
  seedOccurrenceDate: string | null
  /** True when the rule was created from an existing movement. */
  seededFromMovement: boolean
  /** Due dates of the rule's existing instances, in ANY state. */
  existing: Iterable<string>
}): Set<string> {
  const covered = new Set(input.existing)
  if (input.seededFromMovement && input.seedOccurrenceDate != null) {
    covered.add(input.seedOccurrenceDate)
  }
  return covered
}

export type ProjectedOccurrence = {
  rule_id: string
  scheduled_date: string
}

// Safety net, no longer the thing that decides how far a rule can reach: the
// walker positions itself at the window's edge by arithmetic, so this bounds the
// steps taken INSIDE the window, not the life of the rule. See occurrenceIndexAt.
//
// It is a DEFAULT, not a ceiling: counting the positions a rule has spent walks
// its whole life, and three years of a daily rule is past this. A caller that
// knows its own span says so — and running out now THROWS, because the failure
// this replaces was a walk that stopped at 750 and returned a short list with
// nothing to say it had.
const MAX_WALK_STEPS = 750

// How far the arithmetic estimate in `occurrenceIndexAt` may be off. Month-end
// clamping moves it by at most one; the rest is slack.
const MAX_ESTIMATE_CORRECTION = 4

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
  /**
   * How many steps this walk may take. Defaults to `MAX_WALK_STEPS`, which suits
   * a bounded window; a caller walking a rule's whole life passes its own span.
   * Running out throws rather than truncating.
   */
  maxSteps?: number
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
  //
  // The forward bound counts CORRECTIONS, not the index. It used to read
  // `n > MAX_WALK_STEPS`, which is a different quantity: for a rule whose true
  // position is past 750 — a daily rule running two years — the loop was already
  // over its limit before it began, so an estimate that did need correcting came
  // back uncorrected.
  while (n > 0 && satisfies(occurrenceAt(schedule, n - 1))) n -= 1
  for (let steps = 0; !satisfies(occurrenceAt(schedule, n)); steps += 1) {
    if (steps > MAX_ESTIMATE_CORRECTION) {
      throw new Error(
        `occurrenceIndexAt: the estimate for ${date} did not converge on ${start} every ${count} ${unit}`,
      )
    }
    n += 1
  }
  return n
}

// Which occurrence of the schedule `date` is, counting `start_date` as the 1st.
// NULL when `date` is not on the schedule at all.
//
// The null matters. An earlier version returned the ordinal of the next
// occurrence on or after the date, and that silently answers a different
// question: for a rule every 3 days from 2026-05-01, the off-schedule
// 2026-06-13 came back as the 16th — which is the 2026-06-15's ordinal, a
// different occurrence. Used as a cap that drops a due date the rule was owed.
// A date the schedule does not contain has no ordinal, and saying so lets the
// caller decide what to do instead of rounding on its behalf.
//
// This is what `max_occurrences` counts. Expressing the cap as an ordinal — a
// property of the calendar alone — is what keeps the generator, the projection
// and the "próximo" agreeing on how many occurrences a rule has: the number
// cannot drift with what got materialized, resolved or deleted.
export function occurrenceOrdinal(
  schedule: OccurrenceSchedule,
  date: string,
): number | null {
  const n = occurrenceIndexAt(schedule, date, 'on-or-after')
  return occurrenceAt(schedule, n) === date ? n + 1 : null
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
  const { from, to = null, cursor = null, limit, maxSteps = MAX_WALK_STEPS } = window
  const out: string[] = []

  // Position at the window's edge: the first occurrence that is both >= `from`
  // and strictly after the cursor. `produced` keeps counting from start_date,
  // because that is what max_occurrences means.
  let produced = occurrenceIndexAt(schedule, from, 'on-or-after')
  if (cursor != null) {
    produced = Math.max(produced, occurrenceIndexAt(schedule, cursor, 'strictly-after'))
  }

  let current = occurrenceAt(schedule, produced)

  for (let steps = 0; ; steps += 1) {
    if (steps > maxSteps) {
      throw new Error(
        `walkOccurrences: ${maxSteps} steps did not reach ${to ?? 'the end'} from ${from} on ${schedule.start_date} every ${schedule.interval_count} ${schedule.interval_unit}`,
      )
    }
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
  const covered = rule.covered instanceof Set ? rule.covered : new Set(rule.covered)
  // The window never reaches before the schedule rules: see
  // `schedule_effective_from`.
  const floor = rule.schedule_effective_from
  const from = floor != null && floor > windowStart ? floor : windowStart
  if (from > windowEnd) return []
  return walkOccurrences(rule, { from, to: windowEnd }).filter((date) => !covered.has(date))
}

// The next occurrence a rule is still expected to produce — the calendar
// "próximo" for display. The earliest occurrence that is BOTH:
//   (a) on or after `today` — never surface a past date as "próximo"; and
//   (b) not already covered — see `coveredOccurrences`. Without (b) a rule whose
//       occurrence for *today* already exists would announce it as coming.
// Returns null when the rule has no further occurrence (finished or capped out).
//
// (b) used to be "strictly after the cursor", which answered a different
// question: the cursor only moved when the user RESOLVED something, so an
// occurrence sitting unresolved was announced as upcoming while also being
// listed as due. Each occurrence now appears in exactly one place — the review
// block if it exists, the projection if it does not.
export function getNextExpectedOccurrence(
  rule: OccurrenceSchedule,
  today: string,
  covered: Iterable<string>,
): string | null {
  const already = covered instanceof Set ? covered : new Set(covered)
  // Never earlier than the day the current schedule starts ruling: during a gap
  // the answer is the first date of the NEW schedule, not the next one the old
  // calendar would have produced. See `schedule_effective_from`.
  const floor = rule.schedule_effective_from
  const from = floor != null && floor > today ? floor : today
  // Bounded by the covered set, and told so. It steps forward only while it
  // keeps landing on dates that already exist, so one more than there ARE is
  // always enough — and saying it is what keeps this from walking the step
  // budget on every call and throwing away all but the first answer.
  for (const date of walkOccurrences(rule, { from, limit: already.size + 1 })) {
    if (!already.has(date)) return date
  }
  return null
}

/**
 * The dates a user is offered when correcting a rule's reference date.
 *
 * The first occurrence of the corrected schedule that falls on or after `from`,
 * and the one after it. Two, because the ambiguity has exactly two answers: the
 * cycle in flight, or the next one. Fewer when the calendar has fewer to give —
 * a rule past its `end_date` or with its cap spent has no next occurrence at
 * all, and offering a date it will never produce is a promise the calendar does
 * not keep.
 *
 * This DRAWS the question; it does not settle it. The database recomputes the
 * same two dates and refuses anything else, because a date that arrives
 * unverified opens a schedule version on a day off the calendar and every
 * occurrence after it lands on the wrong phase. `candidate-dates-parity` pins
 * the two implementations against each other.
 */
export function candidateEffectiveDates(
  schedule: {
    anchor_date: string
    interval_count: number
    interval_unit: IntervalUnit
    end_date?: string | null
    /** Occurrences the cap still allows, or null when there is no cap. */
    remaining?: number | null
  },
  from: string,
): string[] {
  const remaining = schedule.remaining
  if (remaining != null && remaining <= 0) return []

  // At most two, and the walk is TOLD so. It used to ask for an open-ended walk
  // and take the first two off the front, which meant stepping to whatever the
  // step budget allowed and throwing the rest away — and, once running out of
  // budget became an error instead of a silent stop, it meant erroring on every
  // schedule. The bound belongs where the walk can act on it.
  const wanted = remaining == null ? 2 : Math.min(2, remaining)

  return walkOccurrences(
    {
      start_date: schedule.anchor_date,
      end_date: schedule.end_date ?? null,
      interval_count: schedule.interval_count,
      interval_unit: schedule.interval_unit,
      max_occurrences: null,
      // This walk is what the floor will be CHOSEN FROM. Flooring it by the
      // floor in force would hide the very dates being offered.
      schedule_effective_from: null,
    },
    { from, limit: wanted },
  )
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
