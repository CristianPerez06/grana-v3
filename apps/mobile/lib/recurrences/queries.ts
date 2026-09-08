// Recurrences read layer for mobile. The reads (list, detail, pending instances,
// top suggestion), the lazy generator and the suggestion detection live in
// `@grana/recurrences`, shared with web. These wrappers inject the native
// Supabase client and keep app-level signatures; types are re-exported so the
// rest of the mobile app imports them from here.

import { supabase } from '../supabase'
import {
  getDuplicateRulesFor,
  getRecurrences as getRecurrencesImpl,
  getRecurrenceDetail as getRecurrenceDetailImpl,
  getPendingRecurrenceInstances as getPendingRecurrenceInstancesImpl,
  getTopRecurrenceSuggestion as getTopRecurrenceSuggestionImpl,
  type DuplicateCandidate,
  type DuplicateMatch,
  type PendingRecurrenceInstance,
  type RecurrenceDetail,
  type RecurrenceStatus,
  type RecurrenceSummary,
} from '@grana/recurrences'

export type {
  DuplicateCandidate,
  DuplicateMatch,
  PendingRecurrenceInstance,
  RecurrenceDetail,
  RecurrenceStatus,
  RecurrenceSummary,
}

// Every active/paused rule (the hub partitions these into active/paused/finished
// tabs — "finished" is derived from a past end_date, not a DB status).
export async function getRecurrencesList(): Promise<RecurrenceSummary[]> {
  return getRecurrencesImpl(supabase, { statuses: ['active', 'paused'] })
}

// A single rule + its full instance history, keyed by `id`. Returns null when the
// rule is not found (or RLS-invisible) so the detail renders its not-found state.
export async function getRecurrenceDetail(id: string): Promise<RecurrenceDetail | null> {
  return getRecurrenceDetailImpl(supabase, id)
}

// Pending instances awaiting confirmation — feeds the feed's pending block.
export async function getPendingRecurrences(): Promise<PendingRecurrenceInstance[]> {
  return getPendingRecurrenceInstancesImpl(supabase)
}

// Strongest on-the-fly recurrence suggestion (or null). Auth resolved here; the
// package read takes an explicit userId (an index hint — RLS scopes the rows).
export async function getTopRecurrenceSuggestion() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return getTopRecurrenceSuggestionImpl(supabase, user.id)
}

// Active rules that collide with a candidate (same account, currency and type,
// equal or nearly equal amount). Read BEFORE creating, to warn: it never blocks.
// Mirror of web's `checkDuplicateRecurrences` action.
export async function getDuplicateRules(candidate: DuplicateCandidate): Promise<DuplicateMatch[]> {
  return getDuplicateRulesFor(supabase, candidate)
}
