import type { DbClient } from '@/lib/supabase/db-client'
import {
  generateDueRecurrenceInstances as generateDueRecurrenceInstancesImpl,
  getTopRecurrenceSuggestion as getTopRecurrenceSuggestionImpl,
} from '@grana/recurrences'

// The recurrence reads live in @grana/recurrences so web and mobile share one
// implementation. Most re-export directly; the two below moved auth to the shell
// (they take an explicit userId now), so we keep signature-preserving wrappers
// that resolve the user from the client — every existing web call site still
// passes just the client.
export {
  getRecurrences,
  getPendingRecurrenceInstances,
  getPendingInstancesByRecurrenceId,
  getRecurrenceDetail,
  countPendingSharedRecurrenceInstances,
  getRecurrenceLinkedTransactionIds,
  getRecurrenceLinkForTransaction,
  buildPendingInstanceInsert,
  type RecurrenceRuleForGeneration,
} from '@grana/recurrences'

// Locally-verified claims (no network getUser): the explicit user_id filters in
// the package are an index hint — RLS already scopes the rows.
async function resolveUserId(supabase: DbClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}

export async function generateDueRecurrenceInstances(
  supabase: DbClient,
): Promise<{ created: number }> {
  const userId = await resolveUserId(supabase)
  if (!userId) return { created: 0 }
  return generateDueRecurrenceInstancesImpl(supabase, userId)
}

export function getTopRecurrenceSuggestion(supabase: DbClient) {
  return resolveUserId(supabase).then((userId) =>
    userId ? getTopRecurrenceSuggestionImpl(supabase, userId) : null,
  )
}
