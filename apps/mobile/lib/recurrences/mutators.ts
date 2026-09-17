import {
  acceptRecurrenceSuggestion as acceptRecurrenceSuggestionImpl,
  confirmRecurrenceInstance as confirmRecurrenceInstanceImpl,
  createRecurrence as createRecurrenceImpl,
  deleteRecurrence as deleteRecurrenceImpl,
  dismissRecurrenceSuggestion as dismissRecurrenceSuggestionImpl,
  generateDueRecurrenceInstances,
  pauseRecurrence as pauseRecurrenceImpl,
  resumeRecurrence as resumeRecurrenceImpl,
  skipRecurrenceInstance as skipRecurrenceInstanceImpl,
  updateRecurrence as updateRecurrenceImpl,
  getRecurrenceLinkCandidates as getRecurrenceLinkCandidatesImpl,
  linkMovementToRecurrence as linkMovementToRecurrenceImpl,
  unlinkMovementFromRecurrence as unlinkMovementFromRecurrenceImpl,
  registerRecurrenceAhead as registerRecurrenceAheadImpl,
  type RecurrenceHousehold,
  type GenerationResult,
  type LinkCandidate,
  type LinkErrorCode,
  type BlockingSettlements,
} from '@grana/recurrences'
import { supabase } from '../supabase'
import { getHousehold } from '../shared/queries'

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

// Form variant: unlike the lifecycle mutations (which degrade to a generic
// message), the create/edit forms want the package's own `formError` when it
// carries one (e.g. a usable-account guard). Field-level validation is handled
// client-side by the form, so a `fieldErrors`-only result — which shouldn't
// happen once the form pre-validates — also degrades to the generic error.
function localizeForm(
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
  if (result.formError) return { ok: false, formError: result.formError }
  return { ok: false, formError: t('recurrences.errors.generic') }
}

function authError(t: Translate): { ok: false; formError: string } {
  return { ok: false, formError: t('recurrences.errors.generic') }
}

// Map the mobile `Household` (from getHousehold) to the `RecurrenceHousehold`
// shape the package's createRecurrence needs to validate a shared expense rule.
async function recurrenceHousehold(): Promise<RecurrenceHousehold> {
  const household = await getHousehold()
  if (!household) return null
  return { id: household.id, members: household.members.map((m) => ({ userId: m.userId })) }
}

// Lazy materialization of due instances (fire-and-forget from the hub on focus).
// `created` tells the caller whether to invalidate; `remaining` and `error` are
// what the screen needs in order to offer continuing the reconstruction and to
// avoid rendering a failure as "nothing to review".
export async function generateDueInstances(): Promise<GenerationResult> {
  const userId = await currentUserId()
  if (!userId) return { created: 0, remaining: 0, error: null }
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

// Create a rule from scratch (no movement today). The package materializes the
// first due instance as pending. `input` is validated inside the package.
export async function createRecurrence(
  input: unknown,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  const household = await recurrenceHousehold()
  return localizeForm(await createRecurrenceImpl(supabase, userId, input, household), t)
}

// Edit a rule's mutable fields (amount/frequency/end_date/description). `patch`
// is validated inside the package.
export async function updateRecurrence(
  id: string,
  patch: unknown,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localizeForm(await updateRecurrenceImpl(supabase, userId, id, patch), t)
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

// ── Vincular, desvincular y registrar antes del vencimiento ───────────────────
//
// Paridad con las server actions de web: la implementación compartida hace el
// trabajo y este shell resuelve auth y traduce el rechazo. La invalidación de
// cache la hace la pantalla, como el resto de los mutators de acá.

function localizeLinkError(
  code: LinkErrorCode | undefined,
  blockedBy: BlockingSettlements | undefined,
  errorCode: string | undefined,
  t: Translate,
): string {
  if (code) return t(`recurrences.link.errors.${code}`)
  if (errorCode === 'GRN01') {
    // Se nombra LA ACCIÓN DISPONIBLE para el estado de la liquidación que
    // bloquea. Decir siempre «revertí» manda al usuario a una operación que el
    // sistema no ofrece sobre una pendiente.
    const key =
      blockedBy?.action === 'cancel_own'
        ? 'blocked_cancel_own'
        : blockedBy?.action === 'cancel_other'
          ? 'blocked_cancel_other'
          : 'blocked_revert'
    const base = t(`recurrences.link.errors.${key}`)
    return blockedBy?.multiple
      ? `${base} ${t('recurrences.link.errors.blocked_multiple')}`
      : base
  }
  return t('recurrences.errors.generic')
}

export async function getRecurrenceLinkCandidates(
  recurrenceId: string,
  dueDate: string,
  widen = false,
): Promise<LinkCandidate[]> {
  return getRecurrenceLinkCandidatesImpl(supabase, { recurrenceId, dueDate, widen })
}

export async function linkMovementToRecurrence(
  args: {
    recurrenceId: string
    dueDate: string
    transactionId: string
    confirmConversion?: boolean
  },
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  const result = await linkMovementToRecurrenceImpl(supabase, args)
  if (result.ok) return { ok: true }
  return {
    ok: false,
    formError: localizeLinkError(result.linkErrorCode, undefined, result.errorCode, t),
  }
}

export async function unlinkMovementFromRecurrence(
  instanceId: string,
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  const result = await unlinkMovementFromRecurrenceImpl(supabase, { instanceId, userId })
  if (result.ok) return { ok: true }
  return {
    ok: false,
    formError: localizeLinkError(
      result.linkErrorCode,
      result.blockedBy,
      result.errorCode,
      t,
    ),
  }
}

export async function registerRecurrenceAhead(
  args: { recurrenceId: string; dueDate: string; date?: string; amount?: number },
  t: Translate,
): Promise<RecurrenceMutationOutcome> {
  const userId = await currentUserId()
  if (!userId) return authError(t)
  return localize(await registerRecurrenceAheadImpl(supabase, userId, args), t)
}
