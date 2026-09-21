// ─── What a rule's end looks like, derived ───────────────────────────────────
//
// A rule that can no longer produce anything is FINISHED, whatever its `status`
// column says. The column keeps meaning what the user did to the rule — active,
// paused, deleted — and nothing here writes to it: "finalizada" is an answer the
// calendar gives on every read, so widening a limit takes effect immediately and
// two identical rules never disagree because of when they were created.
//
// The whole module is pure. It receives; it does not look anything up.

import {
  SCHEDULE_NEVER_RULES,
  getNextExpectedOccurrence,
  walkOccurrences,
  type OccurrenceSchedule,
} from './recurrences'

/** What `recurrences.status` holds. Never written by anything in this file. */
export type RecurrenceStoredStatus = 'active' | 'paused' | 'deleted'

export type RecurrenceDisplayState =
  | 'active'
  | 'paused'
  /** No positions ahead and nothing left to resolve. */
  | 'finished'
  /** No positions ahead, but instances still waiting to be confirmed or skipped. */
  | 'finished-with-pending'
  /** A deleted rule is not derived at all — see below. */
  | 'deleted'

export type RecurrenceProgress = {
  /** Positions of the rule's calendar already spent, saturated at `total`. */
  spent: number
  /** The rule's `max_occurrences`. */
  total: number
  /** Never negative: a saturated count cannot owe positions. */
  remaining: number
}

export type RecurrenceLifecycle = {
  state: RecurrenceDisplayState
  /** Null when the rule has no `max_occurrences`: no cap, nothing to measure against. */
  progress: RecurrenceProgress | null
  /** Instances still unresolved, whatever the state. */
  unresolved: number
}

export type RecurrenceLifecycleInput = {
  status: RecurrenceStoredStatus
  /**
   * Whether the rule's calendar still produces something — the walker's answer,
   * not an inference from `end_date` and the count.
   *
   * THIS is what decides the end. A rule can run out of future by its
   * `end_date`, by its limit, or by both, and only the calendar knows which;
   * deriving it from the cap alone leaves out every rule that ended by date.
   *
   * For a PAUSED rule the caller SHALL answer it as if the rule resumed today
   * (`hasFutureOccurrenceIgnoringPauses` below does exactly that). An open pause
   * makes the composed walk produce nothing at all, so asking it plainly would
   * report every paused rule as finished — the opposite error.
   */
  hasFutureOccurrence: boolean
  endDate: string | null
  maxOccurrences: number | null
  /**
   * Positions of the calendar already spent, from the normative count
   * (`occurrencePositionsSpent` / `recurrence_positions_spent`).
   *
   * NOT a count of `recurrence_instances` rows: a rule seeded by a movement has
   * no row for its first occurrence, and a position produced while nothing was
   * generating has none either. Counting rows credits an exhausted rule with
   * occurrences it does not have.
   */
  positionsSpent: number
  /** Instances neither confirmed nor skipped. Says what is left to do, not whether the rule ended. */
  unresolvedCount: number
}

/**
 * The state to show for a rule, and how far along it is.
 *
 * `end_date` and `positionsSpent` are NOT consulted to decide the end — they
 * describe HOW it ended and what is left over. The single question that decides
 * is `hasFutureOccurrence`.
 */
export function deriveRecurrenceLifecycle(
  input: RecurrenceLifecycleInput,
): RecurrenceLifecycle {
  const progress = deriveProgress(input.maxOccurrences, input.positionsSpent)

  // A DELETED RULE STAYS DELETED. Deriving it to "finalizada" would hand it back
  // to a list it was taken out of on purpose. The derivation applies to active
  // and paused rules only, and this is the first thing checked so no later
  // branch can reach it.
  if (input.status === 'deleted') {
    return { state: 'deleted', progress: null, unresolved: input.unresolvedCount }
  }

  if (input.hasFutureOccurrence) {
    // A pause is an interruption, not an end.
    return {
      state: input.status === 'paused' ? 'paused' : 'active',
      progress,
      unresolved: input.unresolvedCount,
    }
  }

  return {
    state: input.unresolvedCount > 0 ? 'finished-with-pending' : 'finished',
    progress,
    unresolved: input.unresolvedCount,
  }
}

function deriveProgress(
  maxOccurrences: number | null,
  positionsSpent: number,
): RecurrenceProgress | null {
  if (maxOccurrences == null) return null
  // Saturated on both sides. `positionsSpent` already saturates at the cap, and
  // saying so here too keeps a rule whose limit was edited from ever reading
  // "12 de 11" or owing a negative number of occurrences.
  const spent = Math.min(Math.max(positionsSpent, 0), maxOccurrences)
  return { spent, total: maxOccurrences, remaining: maxOccurrences - spent }
}

// ─── The two questions a paused rule answers differently ─────────────────────

/**
 * Does this rule's calendar still have anything ahead?
 *
 * Asked of the CURRENT schedule columns — the same walk that announces the
 * "próximo" — so the two can never disagree: a rule with a next date is never
 * shown as finished, and one without a next date is never shown as active.
 *
 * Pauses do not enter here, and that is deliberate rather than an omission: the
 * composed walk subtracts an open pause and then produces nothing, which would
 * make "está pausada" and "ya terminó" indistinguishable. Walking the schedule
 * itself answers the question that actually matters — *if this rule resumed
 * today, would it still produce?* — and leaves WHEN it ends to
 * `lastExpectedOccurrence`, which refuses to guess while a pause is open.
 */
export function hasFutureOccurrenceIgnoringPauses(
  rule: OccurrenceSchedule,
  today: string,
  covered: Iterable<string>,
): boolean {
  return getNextExpectedOccurrence(rule, today, covered) != null
}

export type LastExpectedOccurrence =
  /** The date of the rule's final occurrence. */
  | { kind: 'date'; date: string }
  /**
   * The rule is paused with no resume date, so the final date depends on a day
   * that has not happened yet. The UI SHALL say it is calculated on resuming —
   * never show an estimate as if it were certain.
   */
  | { kind: 'unknown-while-paused' }
  /** Nothing to project: the rule has no limit, or has no positions left. */
  | { kind: 'none' }

export type LastExpectedOccurrenceInput = {
  /** The rule's CURRENT schedule, exactly as the "próximo" reads it. */
  rule: OccurrenceSchedule
  today: string
  maxOccurrences: number | null
  /** See `RecurrenceLifecycleInput.positionsSpent`. */
  positionsSpent: number
  /** True while a pause has no `resumed_at`. */
  hasOpenPause: boolean
  /**
   * Dates AFTER today that `positionsSpent` already counted: occurrences the
   * user resolved before their date arrived. The walk below must skip them, or
   * it counts them a second time and projects an end one position too early.
   *
   * It is the one case where "spent" and "still ahead in the calendar" overlap.
   * Everything else the count includes is dated up to today, which the walk
   * never revisits.
   */
  resolvedAhead?: Iterable<string>
}

/**
 * The date of the rule's last occurrence, walked rather than computed.
 *
 * It is NOT persisted anywhere: pausing a rule or correcting its reference date
 * moves it, and a stored value would go on stating the old one. It is derived
 * here, from the same walker that produces the real dates, so a corrected
 * schedule carries it along.
 *
 * WHY IT WALKS `remaining` POSITIONS AND NOT "the position numbered
 * max_occurrences": because a pause skips calendar positions without spending
 * them, so the cap's last position and the calendar's n-th stopped being the
 * same thing the first time anyone paused a rule. Counting forward from what is
 * actually left keeps this answer and the "quedan N" on screen describing one
 * calendar.
 */
export function lastExpectedOccurrence(
  input: LastExpectedOccurrenceInput,
): LastExpectedOccurrence {
  // A rule without a limit ends by its `end_date` or not at all; either way the
  // detail does not show a projected last occurrence for it.
  if (input.maxOccurrences == null) return { kind: 'none' }

  const remaining = input.maxOccurrences - input.positionsSpent
  if (remaining <= 0) return { kind: 'none' }

  // Asked AFTER the cap, on purpose: a paused rule with its limit spent has
  // genuinely ended, and saying "we will know when you resume" about a rule with
  // nothing left would be an invitation to wait for something that is not coming.
  if (input.hasOpenPause) return { kind: 'unknown-while-paused' }

  // The same floor the "próximo" applies: during a gap, where the old schedule
  // has stopped and the new one has not begun, the calendar starts at the new
  // one. And the fail-closed sentinel means no schedule rules — walking from it
  // would put the year 9999 on screen.
  const floor = input.rule.schedule_effective_from
  if (floor != null && floor >= SCHEDULE_NEVER_RULES) return { kind: 'none' }
  const from = floor != null && floor > input.today ? floor : input.today

  // Las que ya se gastaron sin que su fecha llegara. El caminante las produce
  // igual —son fechas futuras de este calendario— así que hay que pedirle esas
  // de más y descartarlas, o el plan termina una posición antes de lo que debe.
  const spentAhead = new Set(input.resolvedAhead ?? [])

  // Strictly after today, because a position falling ON today is already counted
  // among the spent ones — `cursor` is the walker's word for that.
  const ahead = walkOccurrences(
    {
      ...input.rule,
      // The cap is applied by `remaining`, which came from the normative count.
      // Leaving the rule's own here would apply it twice, against an index that
      // counts calendar positions rather than produced ones.
      max_occurrences: null,
    },
    {
      from,
      cursor: input.today,
      limit: remaining + spentAhead.size,
      // A rule may legitimately have more positions left than the default step
      // budget; the walk positions itself at the edge, so this is the number it
      // actually needs. Running out throws rather than returning a short list.
      maxSteps: remaining + spentAhead.size + 4,
    },
  )

  const last = ahead.filter((date) => !spentAhead.has(date)).slice(0, remaining).at(-1)
  // Fewer than `remaining` came back: the rule's `end_date` cut the calendar
  // before its limit did. The last one the walk produced is still the last one
  // the rule has.
  return last == null ? { kind: 'none' } : { kind: 'date', date: last }
}
