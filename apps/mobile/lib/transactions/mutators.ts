import type { Mutators, MutationResult } from '@grana/movement-form'
import { getTodayAR } from '@grana/money-logic'
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
  registerCardPurchase,
  registerInstallments,
  saveExpenseReimbursement as saveExpenseReimbursementImpl,
  createRecurrenceFromMovement,
  deleteTransaction as deleteTransactionImpl,
  type ThinMutationResult,
} from '@grana/transactions-mutations'
import { updateInstallmentParent } from '@grana/cards'
import { supabase } from '../supabase'

// The mobile binding of the movement form's `Mutators` contract. The shared
// impls in `@grana/transactions-mutations` own validation + the DB write; this
// shell only resolves auth (`supabase.auth.getUser`) and localizes the generic
// Postgres `errorCode` an update surfaces (the web twin does the same with
// `translatePostgresError`). Cache invalidation lives in the screen's
// `onMutationSuccess`, not here — the mutator never touches the query client.

type Translate = (key: string, values?: Record<string, string | number>) => string

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export function createMovementMutators(t: Translate): Mutators {
  const authError = (): { ok: false; formError: string } => ({
    ok: false,
    formError: t('transactions.errors.generic'),
  })

  // Map an update's generic Postgres `errorCode` to a user-facing message, the
  // same 23505→duplicate / else→generic split web's `translatePostgresError`
  // uses for the `transaction` domain. Domain errors already carry `formError`.
  const localize = <T>(result: ThinMutationResult<T>): MutationResult<T> => {
    if (result.ok) return { ok: true }
    if (result.errorCode) {
      return {
        ok: false,
        formError:
          result.errorCode === '23505'
            ? t('transactions.errors.duplicate')
            : t('transactions.errors.generic'),
      }
    }
    return result
  }

  return {
    // ── Thin creates ──
    createIncome: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createIncomeImpl(supabase, userId, input)
    },
    createExpense: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createExpenseImpl(supabase, userId, input, getTodayAR())
    },
    createTransfer: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createTransferImpl(supabase, userId, input)
    },
    createAdjustment: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createAdjustmentImpl(supabase, userId, input)
    },
    createExchange: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createExchangeImpl(supabase, userId, input)
    },

    // ── Thin updates ──
    updateTransaction: async (id, _accountId, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return localize(await updateTransactionImpl(supabase, userId, id, patch, getTodayAR()))
    },
    updateTransfer: async (id, _sourceAccountId, _destinationAccountId, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return localize(await updateTransferImpl(supabase, userId, id, patch))
    },
    updateAdjustment: async (id, _accountId, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return localize(await updateAdjustmentImpl(supabase, userId, id, patch))
    },
    updateExchange: async (id, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return localize(await updateExchangeImpl(supabase, userId, id, patch))
    },
    updateInstallmentParent: async (id, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      const result = await updateInstallmentParent({
        supabase,
        userId,
        parentId: id,
        input: patch,
      })
      return result.ok ? { ok: true } : result
    },
    // Add / edit / remove the reintegro of an existing expense (edit form). The
    // native edit UI doesn't surface it yet; the binding keeps the shared
    // contract complete and is ready for the native edit section to consume.
    saveExpenseReimbursement: async (id, patch) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      const input = { expense_id: id, ...(patch as Record<string, unknown>) }
      return saveExpenseReimbursementImpl({ supabase, userId, input, today: getTodayAR() })
    },

    // ── Orchestrators (shared) ──
    registerCardPurchase: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return registerCardPurchase({ supabase, userId, input, today: getTodayAR() })
    },
    registerInstallments: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return registerInstallments({ supabase, userId, input, today: getTodayAR() })
    },
    createRecurrenceFromMovement: async (input) => {
      const userId = await currentUserId()
      if (!userId) return authError()
      return createRecurrenceFromMovement({ supabase, userId, input })
    },

    // ── Read-only suggestion ──
    // History-based category suggestion is not wired on mobile yet; the form
    // tolerates a null suggestion (no chip shown). Wire to a native read when
    // the suggestion UX lands.
    suggestCategoryFromHistory: async () => null,
  }
}

// Delete a movement from the detail screen. Not part of the form `Mutators`
// contract (the form never deletes) — it's a standalone one-shot the detail
// action invokes. Delegates to the shared thin `deleteTransaction` (guards live
// there) and localizes the result. The guard codes (installment child / paid /
// settlement) are already prevented by the detail's `canDelete` gate, so they're
// defensive here; the realistic runtime failure is `GRN01` (a settled shared
// expense). Mobile surfaces the generic message — web keeps its specific copy.
export async function deleteMovement(
  id: string,
  t: Translate,
): Promise<{ ok: true } | { ok: false; formError: string }> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, formError: t('transactions.errors.generic') }
  const result = await deleteTransactionImpl(supabase, userId, id)
  if (result.ok) return { ok: true }
  return { ok: false, formError: t('transactions.errors.generic') }
}
