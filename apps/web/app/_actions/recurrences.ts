'use server'

import {
  revalidateAfterMovementMutation,
  revalidateAfterRecurrenceMutation,
  revalidateAfterSuggestionMutation,
} from './_helpers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { generateDueRecurrenceInstances } from '@/lib/recurrences/queries'
import { getHousehold } from '@/lib/shared/queries'
import {
  type AcceptRecurrenceSuggestionInput,
  type ConfirmRecurrenceInstanceInput,
  type CreateRecurrenceFromMovementInput,
  type CreateRecurrenceInput,
  type DismissRecurrenceSuggestionInput,
  type UpdateRecurrenceInput,
} from '@grana/validation'
import { createRecurrenceFromMovement as createRecurrenceFromMovementOrchestrator } from '@grana/transactions-mutations'
import {
  acceptRecurrenceSuggestion as acceptRecurrenceSuggestionImpl,
  confirmRecurrenceInstance as confirmRecurrenceInstanceImpl,
  createRecurrence as createRecurrenceImpl,
  deleteRecurrence as deleteRecurrenceImpl,
  dismissRecurrenceSuggestion as dismissRecurrenceSuggestionImpl,
  pauseRecurrence as pauseRecurrenceImpl,
  resumeRecurrence as resumeRecurrenceImpl,
  skipRecurrenceInstance as skipRecurrenceInstanceImpl,
  updateRecurrence as updateRecurrenceImpl,
} from '@grana/recurrences'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

// ── createRecurrenceFromMovement ──────────────────────────────────────────────
// Shell: auth + client + orchestrator + revalidate. Orchestration logic lives
// in `@grana/transactions-mutations` for cross-platform reuse.

export async function createRecurrenceFromMovement(
  input: unknown,
): Promise<ActionResult<CreateRecurrenceFromMovementInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createRecurrenceFromMovementOrchestrator({
    supabase,
    userId,
    input,
  })
  if (result.ok) {
    // Eagerly materialize the first due instance so the "por confirmar" aviso
    // appears without a manual refresh (the lazy on-mount trigger only runs when
    // the page remounts). Idempotent via the one-pending-per-rule unique index.
    await generateDueRecurrenceInstances(supabase)
    revalidateAfterRecurrenceMutation()
  }
  return result
}

// ── createRecurrence ──────────────────────────────────────────────────────────
// Shell: auth + client + household read + package mutation + revalidate. The
// rule-creation logic (validation, account checks, shared-split validation,
// eager first-instance generation) lives in @grana/recurrences.

export async function createRecurrence(
  input: unknown,
): Promise<ActionResult<CreateRecurrenceInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const household = await getHousehold(supabase)
  const result = await createRecurrenceImpl(supabase, userId, input, household)
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

// ── confirmRecurrenceInstance ─────────────────────────────────────────────────

export async function confirmRecurrenceInstance(
  instanceId: string,
  overrides: unknown,
): Promise<ActionResult<ConfirmRecurrenceInstanceInput> & { transactionId?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await confirmRecurrenceInstanceImpl(
    supabase,
    userId,
    instanceId,
    overrides,
  )
  if (!result.ok && result.mapErrorCode) {
    const tm = await getTranslations('recurrences.mapper_errors')
    return { ok: false, formError: tm(result.mapErrorCode) }
  }
  if (result.ok) {
    // Confirming creates a movement linked to the instance — invalidate both the
    // recurrence-related routes and the movement-affected routes.
    revalidateAfterRecurrenceMutation()
    revalidateAfterMovementMutation()
  }
  return result
}

// ── skipRecurrenceInstance ────────────────────────────────────────────────────

export async function skipRecurrenceInstance(
  instanceId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await skipRecurrenceInstanceImpl(supabase, userId, instanceId)
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

// ── updateRecurrence ──────────────────────────────────────────────────────────

export async function updateRecurrence(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateRecurrenceInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await updateRecurrenceImpl(supabase, userId, id, input)
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

// ── pauseRecurrence / resumeRecurrence ────────────────────────────────────────

export async function pauseRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await pauseRecurrenceImpl(supabase, userId, id)
  if (!result.ok && result.errorCode) {
    return { ok: false, formError: await translatePostgresError(result.errorCode, 'recurrence') }
  }
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

export async function resumeRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await resumeRecurrenceImpl(supabase, userId, id)
  if (!result.ok && result.errorCode) {
    return { ok: false, formError: await translatePostgresError(result.errorCode, 'recurrence') }
  }
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

// ── deleteRecurrence (soft-delete) ────────────────────────────────────────────

export async function deleteRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await deleteRecurrenceImpl(supabase, userId, id)
  if (result.ok) revalidateAfterRecurrenceMutation()
  return result
}

// ── acceptRecurrenceSuggestion ────────────────────────────────────────────────

export async function acceptRecurrenceSuggestion(
  input: unknown,
): Promise<ActionResult<AcceptRecurrenceSuggestionInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await acceptRecurrenceSuggestionImpl(supabase, userId, input)
  if (result.ok) {
    // Accepting a suggestion creates a rule from it (the rule itself is the
    // suggestion's confirmation), so invalidate both the recurrence routes and
    // the suggestion banner.
    revalidateAfterRecurrenceMutation()
    revalidateAfterSuggestionMutation()
  }
  return result
}

// ── dismissRecurrenceSuggestion ───────────────────────────────────────────────

export async function dismissRecurrenceSuggestion(
  input: unknown,
): Promise<ActionResult<DismissRecurrenceSuggestionInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await dismissRecurrenceSuggestionImpl(supabase, userId, input)
  if (!result.ok && result.errorCode) {
    return { ok: false, formError: await translatePostgresError(result.errorCode, 'recurrence') }
  }
  // Dismissing only updates the suggestion list; no rule or movement change.
  if (result.ok) revalidateAfterSuggestionMutation()
  return result
}

// ── generateDueRecurrenceInstancesAction ──────────────────────────────────────
// Lazy materialization of due recurrence instances, fired-and-forgotten from the
// /transactions shell on mount (web-data-access spec: writes never block the read
// path). The caller invalidates pending-recurrences + movements when
// `created > 0` so the new instance appears without a reload.

export async function generateDueRecurrenceInstancesAction(): Promise<{ created: number }> {
  return generateDueRecurrenceInstances(await createClient())
}
