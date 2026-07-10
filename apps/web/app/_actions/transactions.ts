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

  // Block deletion of individual installment children — must delete from parent
  const { data: tx } = await supabase
    .from('transactions')
    .select('parent_id, status, is_shared, household_id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (tx?.parent_id) {
    return {
      ok: false,
      formError: 'Para eliminar una cuota, eliminá la compra completa desde el movimiento padre.',
    }
  }

  // Block deletion of paid credit card transactions
  if (tx?.status === 'paid') {
    return {
      ok: false,
      formError: 'No podés eliminar un consumo que ya fue pagado en el resumen.',
    }
  }

  // A settlement leg belongs to a household settlement (cuenta corriente).
  // Deleting it here would orphan the other member's leg and bypass the
  // reversal-by-contraasiento — it must be reverted from the cuenta corriente.
  if (tx?.type === 'settlement') {
    return {
      ok: false,
      formError: 'Es parte de una liquidación del hogar. Revertila desde la cuenta corriente.',
    }
  }

  // Deleting a shared expense that a settlement already covered would rewrite a
  // settled balance. The temporal guard (see 0043 + 0049) blocks the delete only
  // when a same-currency settlement is dated at/after the expense, raising SQLSTATE
  // GRN01 which we map to a friendly message. Reversal by contraasiento is Paso 3.
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    if (error.code === 'GRN01') {
      return {
        ok: false,
        formError:
          'No se puede borrar: hay una liquidación registrada después de este gasto en el hogar. Revertí esa liquidación primero.',
      }
    }
    return { ok: false, formError: await translatePostgresError(error.code, 'transaction') }
  }

  revalidateAfterMovementMutation()
  return { ok: true }
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
