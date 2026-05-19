import { getNextRecurrenceDate, type RecurrenceFrequency } from './date'

// Pure decision: given a rule, today's date, and whether a pending instance
// already exists, decide whether the generator should create a new pending
// instance for this rule, and if so, with which scheduled_date.
//
// Extracted from generateDueRecurrenceInstances so it can be tested without
// hitting the database. The generator wraps this with the DB fetch/insert.

export type RuleForDecision = {
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  frequency: RecurrenceFrequency
}

export type GenerationDecision =
  | { generate: false; reason: 'has_pending' | 'not_due' | 'past_end_date' }
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
  const baseDate = rule.last_generated_date ?? rule.start_date
  const nextDate = getNextRecurrenceDate(baseDate, rule.frequency, {
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

  return { generate: true, scheduled_date: nextDate }
}
