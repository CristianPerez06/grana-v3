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
  | { kind: 'empty' }
  | { kind: 'list' }

/**
 * What the feed of unresolved occurrences is in.
 *
 * `unreadable` exists because it used to be folded into `empty`: a failed read
 * became `data ?? []` and the block disappeared, which tells the user they have
 * nothing to review when the truth is that nobody knows. It is the same defect
 * as a swallowed materialization error, one layer up.
 */
export function reviewFeedState(query: {
  isPending: boolean
  error: unknown
  data: unknown[] | undefined
}): ReviewFeedState {
  if (query.error != null) return { kind: 'unreadable' }
  if (query.isPending || query.data == null) return { kind: 'loading' }
  return query.data.length === 0 ? { kind: 'empty' } : { kind: 'list' }
}
