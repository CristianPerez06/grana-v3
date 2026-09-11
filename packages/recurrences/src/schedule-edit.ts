import { candidateEffectiveDates } from '@grana/money-logic'
import type { IntervalUnit } from '@grana/money-logic'

/**
 * What to ask when a rule's reference date changes — the one decision, shared by
 * web and native so the two cannot answer it differently.
 *
 * Moving a rule's anchor is ambiguous, and no arithmetic resolves it: the cycle
 * in flight may already be settled, in which case the corrected schedule must
 * rule from the NEXT one, or it may not be, in which case it must rule now. From
 * the data the two situations are identical — two dates of the same rule — so
 * the person who knows answers, with concrete dates rather than talk of
 * "periods", which a rule every three days does not have.
 */
export type ReferenceDateChoice =
  /** An active rule with occurrences ahead: the user picks which one is the first. */
  | { kind: 'ask'; options: string[] }
  /**
   * A paused rule. No question: both dates would fall inside the pause, and
   * calling either "the first occurrence" is a promise the calendar will not
   * keep. The corrected schedule rules from today and waits for the rule to
   * resume — which is what the form says instead of asking.
   */
  | { kind: 'paused' }
  /**
   * Nothing left to offer: the rule is past its `end_date` or has spent its cap.
   * There is no next occurrence, so there is no date that could be the first
   * with the new reference.
   */
  | { kind: 'exhausted' }

export function referenceDateChoice(
  rule: {
    status: string
    interval_count: number
    interval_unit: IntervalUnit
    end_date: string | null
    max_occurrences: number | null
    /**
     * Positions of the rule's calendar already spent — what `max_occurrences`
     * counts. NOT the number of `recurrence_instances`: a rule seeded by a
     * movement has no row for its first occurrence, and a position the calendar
     * produced while nothing was generating has none either. Counting rows tells
     * a spent rule it still has occurrences and offers a reference date for one
     * that will never fire again. The database computes it, and the RPC
     * validates the chosen date against the very same number.
     */
    positionsSpent: number
  },
  newAnchor: string,
  today: string,
): ReferenceDateChoice {
  if (rule.status === 'paused') return { kind: 'paused' }

  const options = candidateEffectiveDates(
    {
      anchor_date: newAnchor,
      interval_count: rule.interval_count,
      interval_unit: rule.interval_unit,
      end_date: rule.end_date,
      remaining:
        rule.max_occurrences == null ? null : rule.max_occurrences - rule.positionsSpent,
    },
    today,
  )

  return options.length === 0 ? { kind: 'exhausted' } : { kind: 'ask', options }
}
