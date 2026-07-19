import {
  acceptRecurrenceSuggestion as acceptRecurrenceSuggestionImpl,
  confirmRecurrenceInstance as confirmRecurrenceInstanceImpl,
  deleteRecurrence as deleteRecurrenceImpl,
  dismissRecurrenceSuggestion as dismissRecurrenceSuggestionImpl,
  generateDueRecurrenceInstances,
  pauseRecurrence as pauseRecurrenceImpl,
  resumeRecurrence as resumeRecurrenceImpl,
  skipRecurrenceInstance as skipRecurrenceInstanceImpl,
} from '@grana/recurrences'
import { supabase } from '../supabase'

// The mobile binding of the recurrence lifecycle/instance mutations. The shared
// impls in `@grana/recurrences` own validation + the DB write; this shell only
// resolves auth (`supabase.auth.getUser`) and localizes the result. Cache
// invalidation lives in the screen's success handler, not here.

type Translate = (key: string, values?: Record<string, string | number>) => string

export type RecurrenceMutationOutcome =
  | { ok: true }
  | { ok: false; formError: string }

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Map the package result to a fully-localized outcome. A `mapErrorCode` (a
// RecurrenceMapError from confirming) is translated via `recurrences.mapper_errors`;
// everything else degrades to a generic recurrence error to keep the copy
// locale-consistent (the package's guard messages are Spanish-only, like the
// delete guards mobile already generalizes).
function localize(
  result:
    | { ok: true }
    | {
        ok: false
        formError?: string
        errorCode?: string
        mapErrorCode?: string
        fieldErrors?: Record<string, string | undefined>
      },
  t: Translate,
): RecurrenceMutationOutcome {
  if (result.ok) return { ok: true }
  if (result.mapErrorCode) {
    return { ok: false, formError: t(`recurrences.mapper_errors.${result.mapErrorCode}`) }
  }
  return { ok: false, formError: t('recurrences.errors.generic') }
}

function authError(t: Translate): { ok: false; formError: string } {
  return { ok: false, formError: t('recurrences.errors.generic') }
}

// Lazy materialization of due instances (fire-and-forget from the hub on focus).
// Returns { created } so the caller can invalidate only when something appeared.
export async function generateDueInstances(): Promise<{ created: number }> {
  const userId = await currentUserId()
  if (!userId) return { created: 0 }
  return generateDueRecurrenceInstances(supabase, userId)
}

export async function pauseRecurrence(
  id: string,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await pauseRecurrenceImpl(supabase, userId, id), t)
}

export async function resumeRecurrence(
  id: string,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await resumeRecurrenceImpl(supabase, userId, id), t)
}

export async function deleteRecurrence(
  id: string,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await deleteRecurrenceImpl(supabase, userId, id), t)
}

export async function confirmRecurrenceInstance(
  instanceId: string,
  overrides: unknown,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(
    await confirmRecurrenceInstanceImpl(supabase, userId, instanceId, overrides),
    t,
  )
}

export async function skipRecurrenceInstance(
  instanceId: string,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await skipRecurrenceInstanceImpl(supabase, userId, instanceId), t)
}

export async function acceptRecurrenceSuggestion(
  input: unknown,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await acceptRecurrenceSuggestionImpl(supabase, userId, input), t)
}

export async function dismissRecurrenceSuggestion(
  input: unknown,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await dismissRecurrenceSuggestionImpl(supabase, userId, input), t)
}
