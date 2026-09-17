import type { PendingRecurrenceInstance } from './types'

/**
 * The decisions the "vencimientos por revisar" surfaces make, in one place.
 *
 * Web and native answer the same questions — is anything already due, what will
 * resolving this row write, what is the materialization saying — and they used
 * to answer them separately. That is how the two drifted: the native block never
 * showed what a row would create, and its collapse rule was written twice.
 *
 * Everything here reads `due_date`, the occurrence's identity. NOT
 * `scheduled_date`: on a resolved row that column holds a legacy date of
 * uncertain meaning, and reading it as the vencimiento is what let a cuota due in
 * August be sorted and displayed by the day it was paid in September.
 */

/**
 * Should the block start OPEN?
 *
 * Yes whenever anything is already due, however many there are. It used to do
 * the opposite — collapse from two onwards — so the more the user had to review,
 * the better it was hidden. Only a block made entirely of occurrences that have
 * not fallen due yet stays collapsed.
 */
export function shouldOpenReviewBlock(
  instances: Pick<PendingRecurrenceInstance, 'due_date'>[],
  today: string,
): boolean {
  return instances.some((instance) => instance.due_date <= today)
}

export type ReviewUrgency =
  | { kind: 'overdue'; days: number }
  | { kind: 'due_today' }
  | { kind: 'due_in'; days: number }

/** How late — or how early — an occurrence is, relative to the accounting date. */
export function reviewUrgency(dueDate: string, today: string): ReviewUrgency {
  const days = daysBetween(today, dueDate)
  if (days < 0) return { kind: 'overdue', days: -days }
  if (days === 0) return { kind: 'due_today' }
  return { kind: 'due_in', days }
}

function daysBetween(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export type ResolutionPreview = {
  /** i18n key under `recurrences.pending.will_create`. */
  kind: 'expense' | 'income' | 'transfer'
  /** The date the movement will carry: the vencimiento, unless the user edits it. */
  date: string
  account: string | null
  destination: string | null
}

/**
 * WHAT resolving this row will write, so the surface can say it instead of
 * asking the user to infer it. Same answer on both platforms, by construction.
 */
export function resolutionPreview(
  instance: Pick<
    PendingRecurrenceInstance,
    'due_date' | 'account' | 'destination_account' | 'recurrence'
  >,
): ResolutionPreview {
  const type = instance.recurrence.movement_type
  return {
    kind: type === 'income' || type === 'transfer' ? type : 'expense',
    date: instance.due_date,
    account: instance.account?.name ?? null,
    destination: instance.destination_account?.name ?? null,
  }
}

export type MaterializationOutcome =
  | { kind: 'failed' }
  | { kind: 'remaining'; count: number }
  | { kind: 'quiet' }

/**
 * What the materialization notice has to say. `quiet` means render nothing —
 * everything else must be visible, because a swallowed failure leaves a screen
 * identical to a user with nothing to review, which is the opposite claim.
 */
export function materializationOutcome(state: {
  remaining: number
  error: string | null
}): MaterializationOutcome {
  if (state.error != null) return { kind: 'failed' }
  if (state.remaining > 0) return { kind: 'remaining', count: state.remaining }
  return { kind: 'quiet' }
}

export type ReviewFeedState =
  | { kind: 'loading' }
  | { kind: 'unreadable' }
  /** Render the rows. `refreshFailed` adds the "no pudimos actualizar" notice above them. */
  | { kind: 'list'; refreshFailed: boolean }
  | { kind: 'empty' }

/**
 * What the feed of unresolved occurrences is in.
 *
 * `unreadable` exists because it used to be folded into `empty`: a failed read
 * became `data ?? []` and the block disappeared, which tells the user they have
 * nothing to review when the truth is that nobody knows. It is the same defect
 * as a swallowed materialization error, one layer up.
 *
 * A FAILED REFETCH IS NOT A FAILED READ. When rows are already cached, a
 * transient failure keeps them on screen with the notice above: making
 * vencimientos the user was looking at vanish because a background refresh timed
 * out is a worse answer than showing them slightly stale and saying so. Only a
 * failure with nothing to fall back on is `unreadable`.
 *
 * An EMPTY cached list plus a failure is `unreadable` too, deliberately: "no
 * tenés nada por revisar" is a claim, and a failed read cannot support it.
 */
export function reviewFeedState(query: {
  isPending: boolean
  error: unknown
  data: unknown[] | undefined
}): ReviewFeedState {
  const cached = query.data != null && query.data.length > 0
  if (query.error != null) {
    return cached ? { kind: 'list', refreshFailed: true } : { kind: 'unreadable' }
  }
  if (query.isPending || query.data == null) return { kind: 'loading' }
  return query.data.length === 0 ? { kind: 'empty' } : { kind: 'list', refreshFailed: false }
}

export type StuckRule = {
  recurrence_id: string
  /** The vencimiento of the oldest unresolved occurrence. */
  since: string
  /** How many unresolved occurrences of this rule are THERE TO REVIEW. */
  count: number
}

/**
 * WHICH RULES ARE STUCK — the thing the app used to keep to itself.
 *
 * A rule is stuck when it has piled up occurrences nobody resolved. Saying so
 * costs nothing and is what turns a three-day annoyance into something the user
 * can act on; the silence is what let #96 run for three months.
 *
 * THE THRESHOLD, and why it takes two conditions. `two or more` alone would flag
 * a fortnightly rule that produced the month's two occurrences and owes neither
 * yet. `something is overdue` alone would flag anyone who did not open the app
 * over a weekend. Together they describe a rule that stopped moving.
 *
 * IT IS A PROPERTY OF THE RULE, not of the block. Three rules with one overdue
 * each are not three stuck rules — that is a user who was away for a few days,
 * and calling it stuck would be alarmism. The block's list stays flat; the count
 * is per rule.
 *
 * THE COUNT IS WHAT EXISTS, NOT THE BACKLOG. Overdue occurrences materialize in
 * bounded runs (`RECONSTRUCTION_BATCH_SIZE`) and continue on the next one, so a
 * long backlog can still owe rows. Counting them is counting what is there to
 * review, which is why the copy says "para revisar" and never "en total".
 *
 * WHETHER THE REBUILD IS STILL RUNNING IS NOT ASKED HERE, and that is deliberate.
 * The only signal available is the materialization's `remaining`, which is a
 * SINGLE NUMBER FOR THE WHOLE RUN — it does not say which rule owes it, and the
 * generator only ever queries `status = 'active'` rules. Attributing it to each
 * rule would make a paused rule announce that we are still recovering "its"
 * backlog while the generator is not looking at it at all. The surface says it
 * once, globally, instead.
 *
 * A rule's `status` does not exempt it. A paused rule with occurrences piled up
 * is stuck too: pausing explains why no more arrive, not why the ones already
 * there stay unresolved.
 */
export function stuckRules(
  instances: Pick<PendingRecurrenceInstance, 'due_date' | 'recurrence'>[],
  today: string,
): StuckRule[] {
  const byRule = new Map<string, string[]>()
  for (const instance of instances) {
    const dates = byRule.get(instance.recurrence.id)
    if (dates) dates.push(instance.due_date)
    else byRule.set(instance.recurrence.id, [instance.due_date])
  }

  const stuck: StuckRule[] = []
  for (const [recurrence_id, dates] of byRule) {
    if (dates.length < 2) continue
    // The oldest one has to have fallen due already. Sorting beats Math.min on
    // ISO dates read as strings, and keeps the comparison textual throughout.
    const since = dates.reduce((oldest, date) => (date < oldest ? date : oldest))
    if (since > today) continue
    stuck.push({ recurrence_id, since, count: dates.length })
  }
  stuck.sort((a, b) => a.since.localeCompare(b.since) || a.recurrence_id.localeCompare(b.recurrence_id))
  return stuck
}
