import type { GranaSupabaseClient } from '@grana/supabase'
import {
  createIncomeSchema,
  createExpenseSchema,
  createTransferSchema,
  createAdjustmentSchema,
  createExchangeSchema,
  updateTransactionSchema,
  updateTransferSchema,
  updateAdjustmentSchema,
  updateExchangeSchema,
  confirmReimbursementSchema,
  cancelReimbursementSchema,
  normalizeMoneyAmount,
  validateActionInput,
  type CreateIncomeInput,
  type CreateExpenseInput,
  type CreateTransferInput,
  type CreateAdjustmentInput,
  type CreateExchangeInput,
  type UpdateTransactionInput,
  type UpdateTransferInput,
  type UpdateAdjustmentInput,
  type UpdateExchangeInput,
  type ConfirmReimbursementInput,
  type CancelReimbursementInput,
} from '@grana/validation'
import {
  formatDateISO,
  getNextExpectedOccurrence,
  getTodayAR,
  type IntervalUnit,
} from '@grana/money-logic'
import { applySharedSplits } from './internal/shared-splits'
import { insertDeclaredReimbursement } from './internal/declared-reimbursement'
import { getCardPeriodsWithStatus, getOrCreatePeriodForDate } from './internal/card-periods'

// ─── Thin movement mutations (isomorphic) ─────────────────────────────────────
// The create/update bodies for simple movements (income/expense/transfer/
// adjustment/exchange), extracted verbatim from the web server actions so web
// and mobile share one insert path. Same boundary as the rollback orchestrators
// in this package: each fn receives an already-authenticated Supabase client +
// the caller's `userId`, validates the raw input with the shared schema, and
// returns `{ ok, id?, formError?, errorCode?, fieldErrors? }`.
//
// The fn owns validation + the DB write; it does NOT resolve auth and does NOT
// invalidate cache. Auth (`getAuthenticatedUserId` on web / `auth.getUser` on
// mobile) and cache invalidation (`revalidatePath` on web / TanStack on mobile)
// stay in each platform's shell. Generic Postgres errors are surfaced as
// `errorCode` so the shell can localize them (web via `translatePostgresError`,
// mobile via its own map); domain-specific errors carry a literal `formError`.

export type ThinMutationResult<T> =
  | { ok: true; id?: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
    }

function normalizeMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

// A currency must be active on the account before it can carry a movement.
export async function verifyActiveCurrency(
  supabase: GranaSupabaseClient,
  accountId: string,
  currencyCode: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('account_currencies')
    .select('id')
    .eq('account_id', accountId)
    .eq('currency_code', currencyCode)
    .eq('is_active', true)
    .single()

  return data !== null
}

// ── createIncome ──────────────────────────────────────────────────────────────

export async function createIncome(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<ThinMutationResult<CreateIncomeInput>> {
  const validation = await validateActionInput(createIncomeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'income',
      amount: normalizeMoney(validation.data.amount),
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      category_id: validation.data.category_id,
      subcategory_id: validation.data.subcategory_id ?? null,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el ingreso.' }
  }

  return { ok: true, id: data.id }
}

// ── createExpense ─────────────────────────────────────────────────────────────
// `today` feeds the declared-reimbursement helper (its accreditation-date
// placeholder); every other create is date-free.

export async function createExpense(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
  today: Date,
): Promise<ThinMutationResult<CreateExpenseInput>> {
  const validation = await validateActionInput(createExpenseSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'expense',
      amount: normalizeMoney(validation.data.amount),
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      category_id: validation.data.category_id,
      subcategory_id: validation.data.subcategory_id ?? null,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el gasto.' }
  }

  // Declared reimbursement: created atomically-with-rollback.
  if (validation.data.reimbursement) {
    const r = await insertDeclaredReimbursement(supabase, {
      userId,
      expenseId: data.id,
      currencyCode: validation.data.currency_code,
      declaration: validation.data.reimbursement,
      shared: validation.data.shared,
      today,
    })
    if (!r.ok) {
      await supabase.from('transactions').delete().eq('id', data.id).eq('user_id', userId)
      return { ok: false, formError: `El gasto no se guardó (reintegro inválido): ${r.error}` }
    }
  }

  // Shared expense: mark it + insert per-member splits. Rollback the whole
  // expense (cascades reimbursement + splits) if the split fails.
  if (validation.data.shared) {
    const s = await applySharedSplits(
      supabase,
      { household_id: validation.data.shared.household_id, splits: validation.data.shared.splits },
      [{ transactionId: data.id, amount: normalizeMoney(validation.data.amount) }],
    )
    if (!s.ok) {
      await supabase.from('transactions').delete().eq('id', data.id).eq('user_id', userId)
      return { ok: false, formError: `El gasto no se guardó (compartido inválido): ${s.error}` }
    }
  }

  return { ok: true, id: data.id }
}

// ── createTransfer ────────────────────────────────────────────────────────────

export async function createTransfer(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<ThinMutationResult<CreateTransferInput>> {
  const validation = await validateActionInput(createTransferSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const [sourceActive, destActive] = await Promise.all([
    verifyActiveCurrency(supabase, validation.data.account_id, validation.data.currency_code),
    verifyActiveCurrency(
      supabase,
      validation.data.transfer_destination_account_id,
      validation.data.currency_code,
    ),
  ])

  if (!sourceActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en la cuenta origen.' }
  }
  if (!destActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en la cuenta destino.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      transfer_destination_account_id: validation.data.transfer_destination_account_id,
      type: 'transfer',
      amount: normalizeMoney(validation.data.amount),
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar la transferencia.' }
  }

  return { ok: true, id: data.id }
}

// ── createAdjustment ──────────────────────────────────────────────────────────

export async function createAdjustment(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<ThinMutationResult<CreateAdjustmentInput>> {
  const validation = await validateActionInput(createAdjustmentSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'adjustment',
      amount: normalizeMoney(validation.data.amount),
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el ajuste.' }
  }

  return { ok: true, id: data.id }
}

// ── createExchange ────────────────────────────────────────────────────────────

export async function createExchange(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<ThinMutationResult<CreateExchangeInput>> {
  const validation = await validateActionInput(createExchangeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const [sourceActive, destActive] = await Promise.all([
    verifyActiveCurrency(supabase, validation.data.account_id, validation.data.currency_code),
    verifyActiveCurrency(
      supabase,
      validation.data.transfer_destination_account_id,
      validation.data.destination_currency,
    ),
  ])

  if (!sourceActive) {
    return { ok: false, formError: 'La moneda de origen no está activa en la cuenta de origen.' }
  }
  if (!destActive) {
    return { ok: false, formError: 'La moneda de destino no está activa en la cuenta de destino.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      transfer_destination_account_id: validation.data.transfer_destination_account_id,
      type: 'exchange',
      amount: normalizeMoney(validation.data.amount),
      currency_code: validation.data.currency_code,
      destination_amount: normalizeMoney(validation.data.destination_amount),
      destination_currency: validation.data.destination_currency,
      date: validation.data.date,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el cambio de moneda.' }
  }

  return { ok: true, id: data.id }
}

// ── updateTransaction ─────────────────────────────────────────────────────────
// Generic Postgres errors surface as `errorCode` for the shell to localize; the
// unshare / period-reassignment guards carry their own literal `formError`.

export async function updateTransaction(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  input: unknown,
  today: Date,
): Promise<ThinMutationResult<UpdateTransactionInput>> {
  const validation = await validateActionInput(updateTransactionSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, status, account_id, card_period_id, parent_id, currency_code, date')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existing) return { ok: false, formError: 'Transacción no encontrada.' }

  // Debit-account change (statement payment only). Guard: never move the account
  // of a card consumption — its account drives the period. Allowed only for an
  // off-period movement (`card_period_id IS NULL`), which is the case for a
  // statement payment (its period link lives in `period_payments`). The new
  // account must be a non-credit account with the movement's currency active.
  // Balances are derived, so they recompute on their own after the UPDATE.
  if (
    validation.data.account_id !== undefined &&
    validation.data.account_id !== existing.account_id
  ) {
    if (existing.card_period_id != null) {
      return { ok: false, formError: 'No podés cambiar la cuenta de un consumo de tarjeta.' }
    }
    const { data: newAccount } = await supabase
      .from('accounts')
      .select('type')
      .eq('id', validation.data.account_id)
      .eq('user_id', userId)
      .single()
    if (!newAccount) return { ok: false, formError: 'La cuenta seleccionada no existe.' }
    if (newAccount.type === 'credit') {
      return { ok: false, formError: 'El pago no puede salir de una tarjeta de crédito.' }
    }
    const currencyActive = await verifyActiveCurrency(
      supabase,
      validation.data.account_id,
      existing.currency_code,
    )
    if (!currencyActive) {
      return { ok: false, formError: 'La cuenta seleccionada no tiene esa moneda activa.' }
    }
  }

  // A single installment (cuota) is immutable on its own: amount, date and
  // category are owned by the parent (madre). Editing one cuota would desync the
  // family, so amount/date changes must go through `updateInstallmentParent`.
  if (
    existing.parent_id != null &&
    (validation.data.amount !== undefined || validation.data.date !== undefined)
  ) {
    return {
      ok: false,
      formError:
        'El monto de una compra en cuotas se edita desde la compra original, no desde cada cuota.',
    }
  }

  // A paid credit-card consumption is immutable except for category/description.
  if (
    existing.status === 'paid' &&
    (validation.data.amount !== undefined || validation.data.date !== undefined)
  ) {
    return {
      ok: false,
      formError: 'No podés modificar el monto ni la fecha de un consumo ya pagado.',
    }
  }

  // Card consumos: the statement assignment is date-derived, so a date change
  // moves the consumo to the period that covers the new date (same resolution
  // as the insert). Moving into an already-paid statement is blocked.
  let periodReassignment: { card_period_id: string; due_date: string | null } | null = null
  if (validation.data.date !== undefined && existing.card_period_id && existing.account_id) {
    const newDate = validation.data.date
    const periods = await getCardPeriodsWithStatus(supabase, existing.account_id)
    const current = periods.find((p) => p.id === existing.card_period_id)
    const currentStillCovers =
      current != null &&
      !current.has_payment &&
      current.start_date <= newDate &&
      newDate <= current.end_date

    if (!currentStillCovers) {
      const paidCover = periods.find(
        (p) => p.has_payment && p.start_date <= newDate && newDate <= p.end_date,
      )
      if (paidCover) {
        return {
          ok: false,
          formError:
            'La nueva fecha cae en un resumen ya pagado. Elegí otra fecha o registrá un ajuste.',
        }
      }
      const newPeriodId = await getOrCreatePeriodForDate(
        supabase,
        existing.account_id,
        newDate,
        today,
      )
      if (newPeriodId !== existing.card_period_id) {
        const { data: targetPeriod } = await supabase
          .from('card_periods')
          .select('due_date')
          .eq('id', newPeriodId)
          .single()
        periodReassignment = {
          card_period_id: newPeriodId,
          due_date: targetPeriod?.due_date ?? null,
        }
      }
    }
  }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && {
        amount: normalizeMoney(validation.data.amount),
      }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
      ...('category_id' in validation.data && { category_id: validation.data.category_id ?? null }),
      ...('subcategory_id' in validation.data && {
        subcategory_id: validation.data.subcategory_id ?? null,
      }),
      ...(validation.data.account_id !== undefined && {
        account_id: validation.data.account_id,
      }),
      ...(periodReassignment ?? {}),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  // Date cascade to the linked reimbursement(s). A reimbursement's accounting
  // date defaults to its origin expense's; when the expense's date moves, a
  // reimbursement that was still following it (its date == the expense's OLD
  // date) moves too. One that was deliberately given a different accreditation
  // date is left untouched. Without this, re-dating an expense stranded its
  // reimbursement on the data-entry day (it kept "hoy" instead of the expense's
  // real date). Balances/debt are derived, so nothing else needs recomputing.
  if (
    validation.data.date !== undefined &&
    existing.date != null &&
    validation.data.date !== existing.date
  ) {
    await supabase
      .from('transactions')
      .update({ date: validation.data.date })
      .eq('linked_transaction_id', id)
      .eq('type', 'reimbursement')
      .eq('user_id', userId)
      .eq('date', existing.date)
  }

  // Share toggle reconciliation (only when the form sent it — simple expenses).
  // Clear existing splits on the expense AND any linked reimbursement (which
  // inherits the split), then re-apply the new spec or unshare. The household
  // debt is derived from splits, so it recomputes on its own.
  if ('shared' in validation.data) {
    const spec = validation.data.shared ?? null

    if (spec) {
      // Re-apply in place via upsert — do NOT delete-then-insert. Clearing all of
      // a transaction's splits transiently zeroes their sum, which trips the
      // deferred `trg_splits_sum_total` invariant and rolls the delete back,
      // leaving the old rows to collide with the re-insert. `applySharedSplits`
      // upserts the stable 2-member rows, so the sum stays exact throughout.
      const { data: reimbs } = await supabase
        .from('transactions')
        .select('id, amount')
        .eq('linked_transaction_id', id)
        .eq('type', 'reimbursement')
        .eq('user_id', userId)
      const { data: exp } = await supabase
        .from('transactions')
        .select('amount')
        .eq('id', id)
        .single()
      const targets = [{ transactionId: id, amount: Math.abs(exp?.amount ?? 0) }]
      for (const r of reimbs ?? []) {
        targets.push({ transactionId: r.id, amount: Math.abs(r.amount) })
      }
      const s = await applySharedSplits(
        supabase,
        { household_id: spec.household_id, splits: spec.splits },
        targets,
      )
      if (!s.ok) return { ok: false, formError: `No se pudo actualizar el compartido: ${s.error}` }
    } else {
      // Unshare atomically: flip is_shared and drop the splits in a single DB
      // transaction, deriving the affected movements (this expense + its linked
      // reimbursements) server-side from the root. A client-side delete-then-update
      // would transiently zero the split sum, trip the deferred invariant, roll the
      // delete back and leave orphan splits. The temporal settlement guard raises
      // SQLSTATE GRN01, which we map to a friendly, on-brand message.
      const { error: unshareErr } = await supabase.rpc('unshare_movement', {
        p_root_id: id,
      })
      if (unshareErr) {
        if (unshareErr.code === 'GRN01') {
          return {
            ok: false,
            formError:
              'No se puede descompartir: hay una liquidación registrada después de este gasto en el hogar. Revertí esa liquidación primero.',
          }
        }
        return { ok: false, formError: unshareErr.message }
      }
    }
  }

  return { ok: true }
}

// ── updateTransfer ────────────────────────────────────────────────────────────

export async function updateTransfer(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  input: unknown,
): Promise<ThinMutationResult<UpdateTransferInput>> {
  const validation = await validateActionInput(updateTransferSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('type', 'transfer')
    .single()

  if (!existing) return { ok: false, formError: 'Transferencia no encontrada.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && {
        amount: normalizeMoney(validation.data.amount),
      }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── updateAdjustment ──────────────────────────────────────────────────────────

export async function updateAdjustment(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  input: unknown,
): Promise<ThinMutationResult<UpdateAdjustmentInput>> {
  const validation = await validateActionInput(updateAdjustmentSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('type', 'adjustment')
    .single()

  if (!existing) return { ok: false, formError: 'Ajuste no encontrado.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && {
        amount: normalizeMoney(validation.data.amount),
      }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── updateExchange ────────────────────────────────────────────────────────────

export async function updateExchange(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  input: unknown,
): Promise<ThinMutationResult<UpdateExchangeInput>> {
  const validation = await validateActionInput(updateExchangeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('type', 'exchange')
    .single()

  if (!existing) return { ok: false, formError: 'Cambio de moneda no encontrado.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && {
        amount: normalizeMoney(validation.data.amount),
      }),
      ...(validation.data.destination_amount !== undefined && {
        destination_amount: normalizeMoney(validation.data.destination_amount),
      }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ─── deleteTransaction ────────────────────────────────────────────────────────
// Delete a movement by id, running the same guards web used to inline in its
// server action. Isomorphic: the guards (an installment child must be deleted
// from its madre; a paid consumption is locked; a settlement leg is reverted
// from the cuenta corriente) are surfaced as stable `errorCode` strings so each
// platform localizes them — web maps them back to its literal strings (behavior
// preserved), mobile to its i18n. The temporal guard on a settled shared expense
// raises SQLSTATE `GRN01` from the DB, which flows through as `error.code`.

export const DELETE_GUARD_CODES = {
  installmentChild: 'installment_child',
  paid: 'paid',
  settlement: 'settlement',
  cardPayment: 'card_payment',
  seededRecurrence: 'seeded_recurrence',
} as const

/** The rule a movement seeded, named well enough for the shell to ask about it. */
export type SeededRecurrenceInfo = {
  id: string
  description: string | null
  next_occurrence: string | null
}

export type DeleteTransactionResult = ThinMutationResult<never> & {
  /** Present only with errorCode `seeded_recurrence`: what the user must resolve. */
  seededRecurrence?: SeededRecurrenceInfo
}

/**
 * How to resolve the rule this movement seeded. Absent = don't resolve it, just
 * report it (the default: the user has not chosen yet).
 *
 * `unlink` keeps the rule and detaches it. RESTRICT blocks the DELETE cascade,
 * not a deliberate UPDATE, so clearing the column first is a legitimate path.
 * Deleting the rule instead is orchestrated in `@grana/recurrences`, which owns
 * `deleteRecurrence` (and depends on this package, so the call cannot live here).
 */
export type SeedResolution = 'unlink'

export async function deleteTransaction(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  options: { seedResolution?: SeedResolution; today?: string } = {},
): Promise<DeleteTransactionResult> {
  const { data: tx } = await supabase
    .from('transactions')
    .select('parent_id, status, type')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  // An individual installment (cuota) is deleted from its madre, never alone.
  if (tx?.parent_id) return { ok: false, errorCode: DELETE_GUARD_CODES.installmentChild }
  // A paid credit-card consumption is locked (it already touched a resumen).
  if (tx?.status === 'paid') return { ok: false, errorCode: DELETE_GUARD_CODES.paid }
  // A settlement leg belongs to a household settlement — revert it from the
  // cuenta corriente, not here (deleting orphans the other member's leg).
  if (tx?.type === 'settlement') return { ok: false, errorCode: DELETE_GUARD_CODES.settlement }

  // The payment of a card statement is the counterpart of an operation that also
  // swept the whole statement to `paid` and may have registered a stamp tax.
  // Deleting it in isolation is blocked by the RESTRICT FK on period_payments
  // anyway; undoing it properly is a cards operation (revertCardPeriodPayment),
  // from the period detail where the magnitude of the reversal is visible.
  const { data: statementPayment } = await supabase
    .from('period_payments')
    .select('period_id')
    .eq('transaction_id', id)
    .maybeSingle()
  if (statementPayment) return { ok: false, errorCode: DELETE_GUARD_CODES.cardPayment }

  // A movement that seeded a recurrence cannot be deleted silently: the FK is
  // ON DELETE RESTRICT (0053), so the DB would reject it anyway. We look it up
  // first so the shell can name the rule instead of surfacing a raw FK error,
  // and so the user gets the two real choices (delete the rule, or keep it and
  // unlink). Only the row being deleted is checked: no cascade descendant can
  // be a seed (installment children and reimbursements cannot carry a rule).
  // NOTE: no status filter. RESTRICT blocks the DELETE for ANY row still holding
  // the link, including a rule already soft-deleted (`status='deleted'` keeps the
  // row for the audit trail of its confirmed movements). A soft-deleted rule
  // needs no decision from the user — it is already gone from every list — so it
  // is unlinked automatically below. Only a LIVE rule is a real choice.
  const { data: seededRule } = await supabase
    .from('recurrences')
    .select(
      'id, status, description, start_date, end_date, interval_count, interval_unit, max_occurrences, last_generated_date',
    )
    .eq('created_from_transaction_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (seededRule) {
    const rule = seededRule as unknown as {
      id: string
      status: string
      description: string | null
      start_date: string
      end_date: string | null
      interval_count: number
      interval_unit: IntervalUnit
      max_occurrences: number | null
      last_generated_date: string | null
    }
    const today = options.today ?? formatDateISO(getTodayAR())
    const ruleIsLive = rule.status !== 'deleted'

    if (ruleIsLive && options.seedResolution !== 'unlink') {
      return {
        ok: false,
        errorCode: DELETE_GUARD_CODES.seededRecurrence,
        seededRecurrence: {
          id: rule.id,
          description: rule.description,
          next_occurrence: getNextExpectedOccurrence(rule, today, rule.last_generated_date),
        },
      }
    }

    // Unlink so the RESTRICT lets the movement go. For a live rule being kept:
    // if the cursor sits on a FUTURE start_date, the occurrence it claims to
    // have covered is precisely the movement being deleted — leaving it would
    // make the rule skip that period entirely (the orphan defect 0053 repairs).
    const cursorCoversDeletedSeed =
      ruleIsLive &&
      rule.last_generated_date != null &&
      rule.last_generated_date === rule.start_date &&
      rule.last_generated_date > today

    const { error: unlinkError } = await supabase
      .from('recurrences')
      .update(
        (cursorCoversDeletedSeed
          ? { created_from_transaction_id: null, last_generated_date: null }
          : { created_from_transaction_id: null }) as never,
      )
      .eq('id', rule.id)
      .eq('user_id', userId)

    if (unlinkError) return { ok: false, errorCode: unlinkError.code }
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  // GRN01 = the temporal guard (0043 + 0049): a same-currency settlement dated
  // at/after this shared expense would rewrite a settled balance. Surfaced as
  // `error.code` for the platform to localize.
  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ─── confirmReimbursement (reconcile) ─────────────────────────────────────────
// Confirms a pending reimbursement as received, RECONCILING it: the real amount,
// the real date, and the destination (cash account for 'account', or the card
// period where it landed for 'statement') may differ from what was declared.
// `estimated_amount` is immutable (enforced by the DB trigger). `today` feeds
// `getOrCreatePeriodForDate` for the statement path. Guard messages are literal
// strings the web action surfaced as-is; mobile degrades them to a generic.

export async function confirmReimbursement(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
  today: Date,
): Promise<ThinMutationResult<ConfirmReimbursementInput>> {
  const validation = await validateActionInput(confirmReimbursementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const d = validation.data

  const { data: row, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, type, reimbursement_target, received_at, cancelled_at, account_id')
    .eq('id', d.id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !row) return { ok: false, formError: 'Reintegro no encontrado.' }
  if (row.type !== 'reimbursement') return { ok: false, formError: 'El movimiento no es un reintegro.' }
  if (row.cancelled_at) return { ok: false, formError: 'El reintegro fue cancelado.' }
  if (row.received_at) return { ok: false, formError: 'El reintegro ya fue confirmado.' }

  const update: {
    received_at: string
    amount: number
    date: string
    account_id?: string
    card_period_id?: string
  } = {
    received_at: new Date().toISOString(),
    amount: normalizeMoney(d.amount),
    date: d.date,
  }

  if (row.reimbursement_target === 'account') {
    if (d.account_id) update.account_id = d.account_id
  } else {
    // statement: the card period is the one covering `date` — which defaults to
    // the consumption date and the user may change. Resolve it and ensure it is
    // not already paid.
    if (!row.account_id) {
      return { ok: false, formError: 'El reintegro no tiene una tarjeta asociada.' }
    }
    let periodId: string
    try {
      periodId = await getOrCreatePeriodForDate(supabase, row.account_id, d.date, today)
    } catch {
      return {
        ok: false,
        formError: 'No se pudo determinar el período de la tarjeta para esa fecha.',
      }
    }
    const { data: payment } = await supabase
      .from('period_payments')
      .select('id')
      .eq('period_id', periodId)
      .maybeSingle()
    if (payment) {
      return {
        ok: false,
        formError: 'Ese resumen ya fue pagado. Elegí una fecha de un período no pagado.',
      }
    }
    update.card_period_id = periodId
  }

  const { error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', d.id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  return { ok: true }
}

// ─── cancelReimbursement ──────────────────────────────────────────────────────
// Cancels a pending reimbursement that never arrived (sets `cancelled_at`), so
// it stops showing as expected. A received reimbursement cannot be cancelled
// (received and cancelled are mutually exclusive — see chk_reimbursement_state).
// Idempotent: an already-cancelled reimbursement returns ok.

export async function cancelReimbursement(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<ThinMutationResult<CancelReimbursementInput>> {
  const validation = await validateActionInput(cancelReimbursementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { id } = validation.data

  const { data: row, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, type, received_at, cancelled_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !row) return { ok: false, formError: 'Reintegro no encontrado.' }
  if (row.type !== 'reimbursement') return { ok: false, formError: 'El movimiento no es un reintegro.' }
  if (row.received_at) return { ok: false, formError: 'No se puede cancelar un reintegro ya recibido.' }
  if (row.cancelled_at) return { ok: true } // already cancelled — idempotent

  const { error } = await supabase
    .from('transactions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  return { ok: true }
}
