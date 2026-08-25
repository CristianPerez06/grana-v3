import {
  reserveAvailability as reserveAvailabilityImpl,
  releaseAvailability as releaseAvailabilityImpl,
  createPurpose as createPurposeImpl,
  renamePurpose as renamePurposeImpl,
  deletePurpose as deletePurposeImpl,
  assignPurpose as assignPurposeImpl,
  type SavingsMutationResult,
} from '@grana/savings'
import { getTodayAR } from '@grana/money-logic'
import { supabase } from '../supabase'

/**
 * Native shell over the shared mutations. Mobile has no server actions, so the
 * user id comes from the session and the call goes straight to the package —
 * the cap and the floor still live inside it, validated against a fresh server
 * read at write time.
 */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Unauthorized')
  return id
}

export async function reserveAvailability(input: unknown): Promise<SavingsMutationResult> {
  return reserveAvailabilityImpl({
    supabase,
    userId: await currentUserId(),
    input,
    today: getTodayAR(),
  })
}

export async function releaseAvailability(input: unknown): Promise<SavingsMutationResult> {
  return releaseAvailabilityImpl({
    supabase,
    userId: await currentUserId(),
    input,
    today: getTodayAR(),
  })
}

// ── Propósitos ────────────────────────────────────────────────────────────────
// Ninguna de las tres toca un número: crear, renombrar y borrar son operaciones
// sobre una etiqueta. El borrado en particular devuelve la plata a «Sin destino»
// por la regla del schema, no por algo que se haga acá.

export async function createPurpose(input: unknown): Promise<SavingsMutationResult> {
  return createPurposeImpl({ supabase, userId: await currentUserId(), input })
}

export async function renamePurpose(
  purposeId: string,
  input: unknown,
): Promise<SavingsMutationResult> {
  return renamePurposeImpl({ supabase, purposeId, input })
}

export async function deletePurpose(purposeId: string): Promise<SavingsMutationResult> {
  return deletePurposeImpl({ supabase, purposeId })
}

export async function assignPurpose(
  reserveId: string,
  purposeId: string | null,
): Promise<SavingsMutationResult> {
  return assignPurposeImpl({ supabase, reserveId, purposeId })
}
