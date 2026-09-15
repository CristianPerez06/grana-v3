// ─── «¿Cómo termina?» — one question, three answers ──────────────────────────
//
// A rule ends in exactly one of three ways, and the form asks it as one
// question. Before this, the limit lived INSIDE the "tiene fecha de fin" block:
// to set it you had to turn on a switch that says something else, and turning
// that switch back off left the number written and invisible. A rule called
// «Plan de pago - 11 cuotas» ended up with a limit of 1 that way, stopped
// reminding after the first instalment, and nothing on any screen said so.
//
// THE POINT OF THIS MODULE is that the payload is derived from WHICH ANSWER IS
// CHOSEN, never assembled field by field. A value the user typed and then walked
// away from has no way to reach the database — it stops being a mistake someone
// could make and becomes impossible by construction. Clearing the other field on
// every change would also work, and is the same kind of fix that already failed:
// it relies on somebody remembering.

/** The three answers. Mutually exclusive, and they cover every case. */
export type RecurrenceEndAnswer = 'never' | 'on-date' | 'after-count'

/**
 * What the form HOLDS: the chosen answer plus whatever is written in each field,
 * chosen or not.
 *
 * Both raw fields are kept on purpose, so that switching answers and switching
 * back does not lose what the user typed. What they must never do is reach the
 * payload, and `endConditionColumns` is where that is decided — once.
 */
export type RecurrenceEndDraft = {
  answer: RecurrenceEndAnswer
  /** The date field's text, `''` when empty. */
  endDate: string
  /** The count field's text, `''` when empty. Digits only; see `sanitizeOccurrenceCount`. */
  maxOccurrences: string
}

export type RecurrenceEndColumns = {
  end_date: string | null
  max_occurrences: number | null
}

/**
 * The `(end_date, max_occurrences)` pair a draft becomes.
 *
 * Reads ONLY the field the answer names. Everything else in the draft is
 * discarded, whatever it holds — that discarding is the feature.
 */
export function endConditionColumns(draft: RecurrenceEndDraft): RecurrenceEndColumns {
  if (draft.answer === 'on-date') {
    const endDate = draft.endDate.trim()
    return { end_date: endDate === '' ? null : endDate, max_occurrences: null }
  }

  if (draft.answer === 'after-count') {
    const count = parseOccurrenceCount(draft.maxOccurrences)
    return { end_date: null, max_occurrences: count }
  }

  return { end_date: null, max_occurrences: null }
}

/**
 * Which answer a rule ALREADY STORED corresponds to, for opening the edit form.
 *
 * A rule carrying BOTH — which the model has always allowed, and which the
 * generation resolved by cutting on whichever came first — reads as
 * `after-count`, so that the more specific commitment is the one preselected.
 * The form does not silently drop the other one: it says the rule has both and
 * asks before saving. See `hasBothEndConditions`.
 */
export function endAnswerForRule(rule: {
  end_date: string | null
  max_occurrences: number | null
}): RecurrenceEndAnswer {
  if (rule.max_occurrences != null) return 'after-count'
  if (rule.end_date != null) return 'on-date'
  return 'never'
}

/**
 * A rule that ends by date AND by count at the same time.
 *
 * The audit of the production database (2026-09-15) found none, and that is NOT
 * why this exists: nothing stops one being created — the native form kept the
 * count visible alongside the date and sent both — and the column pair still
 * permits it. Forbidding the combination would take a CHECK constraint and a
 * decision about the rows that already have it; until then, editing one has to
 * name the situation rather than discard half of it in silence.
 */
export function hasBothEndConditions(rule: {
  end_date: string | null
  max_occurrences: number | null
}): boolean {
  return rule.end_date != null && rule.max_occurrences != null
}

/** The draft an existing rule opens the edit form with. */
export function endDraftForRule(rule: {
  end_date: string | null
  max_occurrences: number | null
}): RecurrenceEndDraft {
  return {
    answer: endAnswerForRule(rule),
    endDate: rule.end_date ?? '',
    maxOccurrences: rule.max_occurrences == null ? '' : String(rule.max_occurrences),
  }
}

/**
 * Digits only, and nothing else.
 *
 * `<input type="number">` is banned for this the same way it is for money: the
 * mouse wheel and the arrow keys change it silently, and a limit that moved
 * without anyone typing is a limit nobody knows about. A text field filtered
 * here has neither behaviour, and behaves the same on both platforms.
 */
export function sanitizeOccurrenceCount(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** The count a field holds, or null when it holds nothing usable. */
export function parseOccurrenceCount(raw: string): number | null {
  const digits = sanitizeOccurrenceCount(raw)
  if (digits === '') return null
  const value = Number(digits)
  return Number.isInteger(value) && value >= 1 ? value : null
}

export type EndConditionProblem =
  /** «después de N» chosen with the field empty or at zero. */
  | { kind: 'count-missing' }
  /** «en una fecha» chosen with the field empty. */
  | { kind: 'date-missing' }
  /** The chosen date is before the rule starts. */
  | { kind: 'date-before-start' }
  /**
   * The new limit is below the positions the rule already spent.
   *
   * Accepting it would show «3 de 3» over a rule that walked five — a number
   * describing nothing, which would also present the rule as finished for a
   * reason that is not true.
   */
  | { kind: 'count-below-spent'; spent: number }

/**
 * Everything wrong with a draft, or null.
 *
 * Shared so the form and the write path apply the SAME rule. The form calling it
 * is a convenience; the write path calling it is the guarantee — see
 * `validateEndCondition`'s use in the recurrence mutations.
 */
export function validateEndCondition(
  draft: RecurrenceEndDraft,
  context: { startDate: string; positionsSpent?: number },
): EndConditionProblem | null {
  const columns = endConditionColumns(draft)

  if (draft.answer === 'on-date') {
    if (columns.end_date == null) return { kind: 'date-missing' }
    if (columns.end_date < context.startDate) return { kind: 'date-before-start' }
    return null
  }

  if (draft.answer === 'after-count') {
    if (columns.max_occurrences == null) return { kind: 'count-missing' }
    const spent = context.positionsSpent
    // Equalling what is spent IS allowed: it is how a user says "this is over",
    // and the rule finishes through the normal derivation.
    if (spent != null && columns.max_occurrences < spent) {
      return { kind: 'count-below-spent', spent }
    }
    return null
  }

  return null
}
