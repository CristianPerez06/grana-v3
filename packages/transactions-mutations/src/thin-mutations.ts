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
} from '@grana/validation'
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
    .select('id, status, account_id, card_period_id, parent_id, currency_code')
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
} as const

export async function deleteTransaction(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
): Promise<ThinMutationResult<never>> {
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
