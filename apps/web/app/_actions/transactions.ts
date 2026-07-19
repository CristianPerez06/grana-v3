'use server'

import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import { revalidateAfterMovementMutation } from './_helpers'
import {
  createIncome as createIncomeImpl,
  createExpense as createExpenseImpl,
  createTransfer as createTransferImpl,
  createAdjustment as createAdjustmentImpl,
  createExchange as createExchangeImpl,
  updateTransaction as updateTransactionImpl,
  updateTransfer as updateTransferImpl,
  updateAdjustment as updateAdjustmentImpl,
  updateExchange as updateExchangeImpl,
  deleteTransaction as deleteTransactionImpl,
  DELETE_GUARD_CODES,
  type ThinMutationResult,
} from '@grana/transactions-mutations'
import type {
  CreateIncomeInput,
  CreateExpenseInput,
  UpdateTransactionInput,
  CreateTransferInput,
  CreateAdjustmentInput,
  UpdateTransferInput,
  UpdateAdjustmentInput,
  CreateExchangeInput,
  UpdateExchangeInput,
} from '@grana/validation'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

// Thin server-action wrappers over the isomorphic mutations in
// `@grana/transactions-mutations`. The shared impl owns validation + the DB
// write; each action only resolves auth, revalidates RSC paths on success, and
// localizes the generic Postgres `errorCode` an update surfaces (create paths
// carry their own literal `formError` and never set `errorCode`).

// Localize + revalidate for the update paths, which surface generic Postgres
// failures as `errorCode` for the platform shell to translate.
async function finishUpdate<T>(result: ThinMutationResult<T>): Promise<ActionResult<T>> {
  if (result.ok) {
    revalidateAfterMovementMutation()
    return { ok: true }
  }
  if (result.errorCode) {
    return { ok: false, formError: await translatePostgresError(result.errorCode, 'transaction') }
  }
  return result
}

// ── createIncome ──────────────────────────────────────────────────────────────

export async function createIncome(
  input: unknown,
): Promise<ActionResult<CreateIncomeInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createIncomeImpl(supabase, userId, input)
  if (result.ok) revalidateAfterMovementMutation()
  return result
}

// ── createExpense ─────────────────────────────────────────────────────────────

export async function createExpense(
  input: unknown,
): Promise<ActionResult<CreateExpenseInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createExpenseImpl(supabase, userId, input, getTodayAR())
  if (result.ok) revalidateAfterMovementMutation()
  return result
}

// ── updateTransaction ─────────────────────────────────────────────────────────

export async function updateTransaction(
  id: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult<UpdateTransactionInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishUpdate(await updateTransactionImpl(supabase, userId, id, input, getTodayAR()))
}

// ── deleteTransaction ─────────────────────────────────────────────────────────

export async function deleteTransaction(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await deleteTransactionImpl(supabase, userId, id)
  if (result.ok) {
    revalidateAfterMovementMutation()
    return { ok: true }
  }

  // Map the shared mutator's stable `errorCode` back to web's literal messages
  // (the guards used to live inline here; behavior is unchanged). Unknown codes
  // are generic Postgres failures → the shell translator.
  switch (result.errorCode) {
    case DELETE_GUARD_CODES.installmentChild:
      return {
        ok: false,
        formError: 'Para eliminar una cuota, eliminá la compra completa desde el movimiento padre.',
      }
    case DELETE_GUARD_CODES.paid:
      return { ok: false, formError: 'No podés eliminar un consumo que ya fue pagado en el resumen.' }
    case DELETE_GUARD_CODES.settlement:
      return {
        ok: false,
        formError: 'Es parte de una liquidación del hogar. Revertila desde la cuenta corriente.',
      }
    case 'GRN01':
      return {
        ok: false,
        formError:
          'No se puede borrar: hay una liquidación registrada después de este gasto en el hogar. Revertí esa liquidación primero.',
      }
    default:
      return { ok: false, formError: await translatePostgresError(result.errorCode, 'transaction') }
  }
}

// ── createTransfer ────────────────────────────────────────────────────────────

export async function createTransfer(
  input: unknown,
): Promise<ActionResult<CreateTransferInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createTransferImpl(supabase, userId, input)
  if (result.ok) revalidateAfterMovementMutation()
  return result
}

// ── createAdjustment ──────────────────────────────────────────────────────────

export async function createAdjustment(
  input: unknown,
): Promise<ActionResult<CreateAdjustmentInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createAdjustmentImpl(supabase, userId, input)
  if (result.ok) revalidateAfterMovementMutation()
  return result
}

// ── updateTransfer ────────────────────────────────────────────────────────────

export async function updateTransfer(
  id: string,
  accountId: string,
  destinationAccountId: string,
  input: unknown,
): Promise<ActionResult<UpdateTransferInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishUpdate(await updateTransferImpl(supabase, userId, id, input))
}

// ── updateAdjustment ──────────────────────────────────────────────────────────

export async function updateAdjustment(
  id: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult<UpdateAdjustmentInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishUpdate(await updateAdjustmentImpl(supabase, userId, id, input))
}

// ── deleteTransfer ────────────────────────────────────────────────────────────

export async function deleteTransfer(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'transaction') }

  revalidateAfterMovementMutation()
  return { ok: true }
}

// ── deleteAdjustment ──────────────────────────────────────────────────────────

export async function deleteAdjustment(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'transaction') }

  revalidateAfterMovementMutation()
  return { ok: true }
}

// ── createExchange ────────────────────────────────────────────────────────────

export async function createExchange(
  input: unknown,
): Promise<ActionResult<CreateExchangeInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await createExchangeImpl(supabase, userId, input)
  if (result.ok) revalidateAfterMovementMutation()
  return result
}

// ── updateExchange ────────────────────────────────────────────────────────────

export async function updateExchange(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateExchangeInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finishUpdate(await updateExchangeImpl(supabase, userId, id, input))
}

// ── deleteExchange ────────────────────────────────────────────────────────────

export async function deleteExchange(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'transaction') }

  revalidateAfterMovementMutation()
  return { ok: true }
}
