'use server'

import { getTranslations } from 'next-intl/server'
import {
  reserveAvailability as reserveAvailabilityImpl,
  releaseAvailability as releaseAvailabilityImpl,
  createPurpose as createPurposeImpl,
  renamePurpose as renamePurposeImpl,
  deletePurpose as deletePurposeImpl,
  type SavingsMutationResult,
} from '@grana/savings'
import type { ReserveAvailabilityInput, SavingsPurposeInput } from '@grana/validation'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'
import { revalidateAfterSavingsMutation } from './_helpers'

// The mutation logic lives in `@grana/savings` so mobile reuses it. These
// wrappers are the web platform shell: resolve the user, build the server
// client, then map the package's neutral result to `ActionResult` and
// revalidate. The package never pre-translates.
//
// The cap and the floor are NOT re-checked here. They are validated inside the
// mutation against a fresh server read, because between the drawer opening and
// the user confirming an expense may have landed — a limit checked anywhere but
// at write time is a limit that can be stale.
async function finish<T>(
  result: SavingsMutationResult<T>,
  currencyCode: string,
): Promise<ActionResult<T> & { id?: string; reason?: string }> {
  if (result.ok) {
    revalidateAfterSavingsMutation()
    return { ok: true, id: result.id }
  }

  let formError: string | undefined
  if (result.messageKey != null) {
    const t = await getTranslations()
    // The error says the NUMBER. "Tenés $300.000 disponibles" tells the user
    // what to do next; "monto inválido" makes them guess.
    formError = t(result.messageKey, {
      limit:
        currencyCode === 'USD'
          ? formatUSD(result.limit ?? 0)
          : formatARS(result.limit ?? 0),
      purpose: result.purposeName ?? '',
    })
  } else if (result.errorCode != null) {
    formError = await translatePostgresError(result.errorCode, 'savings')
  }

  return { ok: false, fieldErrors: result.fieldErrors, formError, reason: result.reason }
}

export async function reserveAvailability(
  input: unknown,
): Promise<ActionResult<ReserveAvailabilityInput> & { id?: string; reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const currency = currencyOf(input)
  return finish(
    await reserveAvailabilityImpl({ supabase, userId, input, today: getTodayAR() }),
    currency,
  )
}

export async function releaseAvailability(
  input: unknown,
): Promise<ActionResult<ReserveAvailabilityInput> & { id?: string; reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const currency = currencyOf(input)
  return finish(
    await releaseAvailabilityImpl({ supabase, userId, input, today: getTodayAR() }),
    currency,
  )
}

/**
 * The currency the error message formats its limit in, read defensively from the
 * raw input: the schema may well have rejected it, and a rejected shape still
 * deserves a readable message. Falls back to pesos, the primary currency.
 */
function currencyOf(input: unknown): string {
  const code = (input as { currency_code?: unknown } | null)?.currency_code
  return code === 'USD' ? 'USD' : 'ARS'
}

// ── Propósitos ────────────────────────────────────────────────────────────────
// Mismo reparto que arriba: la lógica vive en el paquete, acá va la cáscara web.
//
// Ninguna de las tres toca un número. Crear, renombrar y borrar un propósito son
// operaciones sobre una ETIQUETA — el borrado en particular devuelve la plata a
// «Sin destino» por la regla del schema, no por algo que se haga acá.

async function finishPurpose(
  result: SavingsMutationResult<SavingsPurposeInput>,
): Promise<ActionResult<SavingsPurposeInput> & { id?: string }> {
  if (result.ok) {
    revalidateAfterSavingsMutation()
    return { ok: true, id: result.id }
  }

  let formError: string | undefined
  if (result.messageKey != null) {
    const t = await getTranslations()
    // Dice CUÁL es el que ya existe. El índice normaliza mayúsculas y espacios,
    // así que quien escribió "emergencia" chocó contra "Emergencia" y un "ya
    // existe" a secas lo dejaría buscándolo.
    formError = t(result.messageKey, { name: result.conflictingName ?? '' })
  } else if (result.errorCode != null) {
    formError = await translatePostgresError(result.errorCode, 'savings')
  }

  return { ok: false, fieldErrors: result.fieldErrors, formError }
}

export async function createPurpose(
  input: unknown,
): Promise<ActionResult<SavingsPurposeInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishPurpose(await createPurposeImpl({ supabase, userId, input }))
}

export async function renamePurpose(
  purposeId: string,
  input: unknown,
): Promise<ActionResult<SavingsPurposeInput> & { id?: string }> {
  await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishPurpose(await renamePurposeImpl({ supabase, purposeId, input }))
}

export async function deletePurpose(
  purposeId: string,
): Promise<ActionResult<SavingsPurposeInput> & { id?: string }> {
  await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishPurpose(await deletePurposeImpl({ supabase, purposeId }))
}
