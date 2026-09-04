import type { GranaSupabaseClient } from '@grana/supabase'
import {
  formatDateISO,
  addDaysToISO,
  suggestNextPeriodDates,
  splitAmountIntoInstallments,
} from '@grana/money-logic'
import {
  normalizeMoneyAmount,
  createCreditCardSchema,
  updatePeriodDatesSchema,
  validateActionInput,
  Money,
  type CreateCreditCardInput,
  type UpdatePeriodDatesInput,
} from '@grana/validation'
import { applySharedSplits } from '@grana/transactions-mutations'

/**
 * Neutral, platform-agnostic mutation result for credit-card writes. Mirror of
 * `AccountMutationResult` (@grana/accounts): the package never translates. Each
 * consumer resolves the text itself — web via next-intl, mobile via `useT`.
 * - `messageKey`: a full catalog path into `@grana/i18n-messages` (e.g.
 *   `cards.errors.create_failed`). Never a pre-translated literal nor a raw
 *   Postgres `error.message`.
 * - `errorCode`: a raw Postgres code the consumer maps to a message.
 * - `fieldErrors`: per-field validation messages keyed by the input schema.
 */
export type CardMutationResult<T = never> =
  | { ok: true; id?: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      messageKey?: string
      /** Interpolation values for `messageKey` (e.g. `{ date }`), resolved by the consumer's i18n. */
      messageParams?: Record<string, string | number>
      errorCode?: string
    }

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

// ── createCreditCard (2 fechas: resumen actual; el siguiente nace estimado) ──────

/**
 * Single source of truth for the card-create flow. Both the web server action and
 * the mobile `lib/cards/mutations.ts` wrapper delegate here. Inserts an `account`
 * (`type=credit`), its `account_currencies`, and two `card_periods` (P1 real +
 * P2 estimated), deriving the auto name and rolling back the account on a partial
 * failure. `supabase` and `today` are injected so the package stays platform-agnostic.
 */
export async function createCreditCard(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}): Promise<CardMutationResult<CreateCreditCardInput>> {
  const { supabase, userId, today } = args
  const validation = await validateActionInput(createCreditCardSchema, args.input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const todayStr = formatDateISO(today)
  const data = validation.data

  // Sanity: current_end_date must be within ±40 days of today.
  if (data.current_end_date < addDaysToISO(todayStr, -40)) {
    return { ok: false, messageKey: 'cards.errors.current_end_too_old' }
  }
  if (data.current_end_date > addDaysToISO(todayStr, 40)) {
    return { ok: false, messageKey: 'cards.errors.current_end_too_far' }
  }

  // Build auto name if not provided: "Network Banco".
  let cardName = data.name?.trim() ?? ''
  if (!cardName) {
    let networkLabel = data.other_network_name ?? ''
    if (data.network_id) {
      const { data: network } = await supabase
        .from('card_networks')
        .select('name')
        .eq('id', data.network_id)
        .single()
      networkLabel = network?.name ?? ''
    }
    const { data: institution } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', data.institution_id)
      .single()
    cardName = [networkLabel, institution?.name].filter(Boolean).join(' ') || 'Tarjeta'
  }

  // INSERT account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: cardName,
      type: 'credit',
      institution_id: data.institution_id,
      network_id: data.network_id ?? null,
      other_network_name: data.other_network_name ?? null,
      credit_limit: data.credit_limit != null ? normalizeActionMoney(data.credit_limit) : null,
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false, errorCode: accountError?.code, messageKey: 'cards.errors.create_failed' }
  }

  // INSERT account_currencies (initial_balance=0 — a card carries no opening cash)
  const currencyRows = data.currencies.map((c) => ({
    account_id: account.id,
    currency_code: c.currency_code,
    initial_balance: 0,
    initial_balance_date: todayStr,
  }))

  const { error: currencyError } = await supabase
    .from('account_currencies')
    .insert(currencyRows)

  if (currencyError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, errorCode: currencyError.code, messageKey: 'cards.errors.create_failed' }
  }

  // INSERT 2 card_periods
  // P1 (real): start=current_end-30d, end=current_end, due=current_due — the
  // dates the last emitted statement announced.
  // P2 (estimated): the bank announces its real dates only when P1 closes, so
  // it is born projected (is_estimated=true) and confirmed when P1 is paid.
  const projected = suggestNextPeriodDates(
    [{ end_date: data.current_end_date, due_date: data.current_due_date }],
    today,
  )
  const periodRows = [
    {
      account_id: account.id,
      start_date: addDaysToISO(data.current_end_date, -30),
      end_date: data.current_end_date,
      due_date: data.current_due_date,
      is_estimated: false,
    },
    {
      account_id: account.id,
      start_date: addDaysToISO(data.current_end_date, 1),
      end_date: projected.suggestedEndDate,
      due_date: projected.suggestedDueDate,
      is_estimated: true,
    },
  ]

  const { error: periodsError } = await supabase.from('card_periods').insert(periodRows)

  if (periodsError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, errorCode: periodsError.code, messageKey: 'cards.errors.create_failed' }
  }

  return { ok: true, id: account.id }
}

// ── updateCreditCard (name / institution / credit_limit) ─────────────────────────

/**
 * Edit the mutable card fields. `type`, `network_id`, `other_network_name` are
 * immutable post-creation (rejected). No schema: the shape is a partial patch.
 */
export async function updateCreditCard(args: {
  supabase: GranaSupabaseClient
  userId: string
  id: string
  input: unknown
}): Promise<CardMutationResult> {
  const { supabase, userId, id, input } = args
  const safeInput = input as Record<string, unknown>

  if ('type' in safeInput || 'network_id' in safeInput || 'other_network_name' in safeInput) {
    return { ok: false, messageKey: 'cards.errors.network_immutable' }
  }

  const updates: { name?: string; institution_id?: string | null; credit_limit?: number | null } = {}

  if (typeof safeInput.name === 'string') {
    const trimmed = safeInput.name.trim()
    if (trimmed.length < 1 || trimmed.length > 50) {
      return { ok: false, messageKey: 'cards.errors.name_length' }
    }
    updates.name = trimmed
  }
  if ('institution_id' in safeInput) {
    updates.institution_id = (safeInput.institution_id as string | null) ?? null
  }
  if ('credit_limit' in safeInput) {
    const limit = safeInput.credit_limit as number | null
    if (limit !== null && limit <= 0) {
      return { ok: false, messageKey: 'cards.errors.limit_positive' }
    }
    updates.credit_limit = limit != null ? normalizeActionMoney(limit) : limit
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true }
  }

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── updatePeriodDates (edición de fechas de ciclo + cascada de borde) ────────────

/**
 * Edit a statement's close/due dates. When the boundary with the next period
 * moves, the next period's `start_date` is shifted to stay contiguous and the
 * transactions in the affected window are reassigned. The pure sanity checks
 * (chronology, next-period-paid guard) live inside the mutation.
 */
export async function updatePeriodDates(args: {
  supabase: GranaSupabaseClient
  userId: string
  periodId: string
  input: unknown
}): Promise<CardMutationResult<UpdatePeriodDatesInput>> {
  const { supabase, userId, periodId, input } = args
  const validation = await validateActionInput(updatePeriodDatesSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data

  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('account_id, start_date, end_date, due_date')
    .eq('id', periodId)
    .single()

  if (periodError || !period) {
    return { ok: false, messageKey: 'cards.errors.period_not_found' }
  }

  const { data: ownerCheck } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', period.account_id)
    .eq('user_id', userId)
    .single()

  if (!ownerCheck) {
    return { ok: false, messageKey: 'cards.errors.period_no_access' }
  }

  // Alguna pata alcanza: un resumen pagado en dos monedas tiene dos.
  const { data: existingPayment } = await supabase
    .from('period_payments')
    .select('id')
    .eq('period_id', periodId)
    .limit(1)
    .maybeSingle()

  if (existingPayment) {
    return { ok: false, messageKey: 'cards.errors.period_paid_dates_locked' }
  }

  // Chronological check: new end_date must come after start_date
  if (data.end_date <= period.start_date) {
    return { ok: false, messageKey: 'cards.errors.close_after_start' }
  }

  // Boundary cascade with the next period (see the running-cycle notes).
  const { data: nextPeriod } = await supabase
    .from('card_periods')
    .select('id, start_date, end_date')
    .eq('account_id', period.account_id)
    .gt('start_date', period.start_date)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextPeriod) {
    const newNextStart = addDaysToISO(data.end_date, 1)
    const boundaryMoved = newNextStart !== nextPeriod.start_date

    if (boundaryMoved) {
      const { data: nextPayment } = await supabase
        .from('period_payments')
        .select('id')
        .eq('period_id', nextPeriod.id)
        .limit(1)
        .maybeSingle()

      if (nextPayment) {
        return { ok: false, messageKey: 'cards.errors.boundary_next_paid' }
      }

      if (data.end_date >= nextPeriod.end_date) {
        return { ok: false, messageKey: 'cards.errors.would_swallow_next' }
      }

      const isExtending = data.end_date > period.end_date

      if (isExtending) {
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: periodId })
          .eq('card_period_id', nextPeriod.id)
          .lte('date', data.end_date)

        if (reassignError) return { ok: false, errorCode: reassignError.code }
      } else {
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextPeriod.id })
          .eq('card_period_id', periodId)
          .gt('date', data.end_date)

        if (reassignError) return { ok: false, errorCode: reassignError.code }
      }

      const { error: nextUpdateError } = await supabase
        .from('card_periods')
        .update({ start_date: newNextStart })
        .eq('id', nextPeriod.id)

      if (nextUpdateError) return { ok: false, errorCode: nextUpdateError.code }
    }
  }

  const { error: updateError } = await supabase
    .from('card_periods')
    .update({
      end_date: data.end_date,
      due_date: data.due_date,
      is_estimated: false,
    })
    .eq('id', periodId)

  if (updateError) return { ok: false, errorCode: updateError.code }

  return { ok: true }
}

// ── updateInstallmentParent (madre de cuotas: monto / categoría / compartido) ────

/**
 * Edit an installment purchase's parent. Category/description propagate to all
 * children; an amount change re-splits the total across children (blocked once
 * any child is paid); the `shared` toggle reconciles the per-child splits via
 * the shared orchestrator. Returns `sharedTouched` so the shell can revalidate
 * `/shared` only when needed.
 */
export async function updateInstallmentParent(args: {
  supabase: GranaSupabaseClient
  userId: string
  parentId: string
  input: unknown
}): Promise<CardMutationResult & { sharedTouched?: boolean }> {
  const { supabase, userId, parentId, input } = args

  const { data: parent, error: fetchError } = await supabase
    .from('transactions')
    .select('id, amount, date, category_id, subcategory_id, description, installments_total')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('is_parent', true)
    .single()

  if (fetchError || !parent) {
    return { ok: false, messageKey: 'cards.errors.installment_not_found' }
  }

  const safeInput = input as Record<string, unknown>

  const { data: children, error: childrenError } = await supabase
    .from('transactions')
    .select('id, status, installment_n, amount')
    .eq('parent_id', parentId)
    .eq('is_parent', false)

  if (childrenError) return { ok: false, errorCode: childrenError.code }

  const hasPaidChild = (children ?? []).some((c) => c.status === 'paid')

  if (hasPaidChild && ('amount' in safeInput || 'installments_total' in safeInput)) {
    return { ok: false, messageKey: 'cards.errors.installment_amount_locked' }
  }

  const parentUpdates: Record<string, unknown> = {}
  const childUpdates: Record<string, unknown> = {}

  if ('category_id' in safeInput) {
    parentUpdates.category_id = safeInput.category_id
    childUpdates.category_id = safeInput.category_id
  }
  if ('subcategory_id' in safeInput) {
    parentUpdates.subcategory_id = safeInput.subcategory_id
    childUpdates.subcategory_id = safeInput.subcategory_id
  }
  if ('description' in safeInput) {
    parentUpdates.description = safeInput.description
    childUpdates.description = safeInput.description
  }

  // Amount change: re-split the new total across all children (residue on the
  // first installment, matching registerInstallments). Only reachable when no
  // child is paid, per the guard above. Child dates/periods are preserved.
  if ('amount' in safeInput) {
    const rawAmount = Number(safeInput.amount)
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return { ok: false, messageKey: 'cards.errors.amount_positive' }
    }
    const n = parent.installments_total ?? (children?.length ?? 0)
    if (n <= 0) {
      return { ok: false, messageKey: 'cards.errors.installment_no_cuotas' }
    }
    const amounts = splitAmountIntoInstallments(rawAmount, n)
    parentUpdates.amount = rawAmount
    for (const child of children ?? []) {
      const idx = (child.installment_n ?? 0) - 1
      if (idx < 0 || idx >= amounts.length) continue
      const { error } = await supabase
        .from('transactions')
        .update({ amount: Money.toNumber(amounts[idx]) })
        .eq('id', child.id)
      if (error) return { ok: false, errorCode: error.code }
    }
  }

  if (Object.keys(parentUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(parentUpdates as any)
      .eq('id', parentId)
    if (error) return { ok: false, errorCode: error.code }
  }

  if (Object.keys(childUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(childUpdates as any)
      .eq('parent_id', parentId)
    if (error) return { ok: false, errorCode: error.code }
  }

  // Share toggle reconciliation (only when the form sent it). The split lives on
  // the child cuotas. Re-share upserts in place (no pre-delete: clearing all splits
  // would transiently zero their sum and trip the deferred invariant). Unshare goes
  // through the atomic `unshare_movement` RPC, which flips the flag and drops the
  // splits (parent + children + linked reimbursements) in a single DB transaction.
  // Runs even with paid children: only the split %s move.
  let sharedTouched = false
  if ('shared' in safeInput) {
    sharedTouched = true
    const spec =
      (safeInput.shared as {
        household_id: string
        splits: { user_id: string; percentage: number }[]
      } | null) ?? null

    if (spec) {
      const targets = (children ?? []).map((c) => ({
        transactionId: c.id,
        amount: Math.abs(Number(c.amount)),
      }))
      const s = await applySharedSplits(
        supabase,
        { household_id: spec.household_id, splits: spec.splits },
        targets,
      )
      if (!s.ok) {
        return {
          ok: false,
          messageKey: 'cards.errors.shared_update_failed',
          messageParams: { error: s.error },
          sharedTouched,
        }
      }
      const { error: markErr } = await supabase
        .from('transactions')
        .update({ is_shared: true, household_id: spec.household_id })
        .eq('id', parentId)
      if (markErr) return { ok: false, errorCode: markErr.code, sharedTouched }
    } else {
      // Atomic unshare via RPC. The temporal settlement guard (0043 + 0049) raises
      // SQLSTATE GRN01 when a same-currency settlement is dated at/after a covered
      // cuota — mapped to a friendly message; any other error is surfaced generically.
      const { error: unshareErr } = await supabase.rpc('unshare_movement', {
        p_root_id: parentId,
      })
      if (unshareErr) {
        if (unshareErr.code === 'GRN01') {
          return { ok: false, messageKey: 'cards.errors.shared_unshare_settlement', sharedTouched }
        }
        return {
          ok: false,
          messageKey: 'cards.errors.shared_update_failed',
          messageParams: { error: unshareErr.message },
          sharedTouched,
        }
      }
    }
  }

  return { ok: true, sharedTouched }
}

// ── deleteInstallmentParent (borrado de la madre; CASCADE borra las hijas) ───────

export async function deleteInstallmentParent(args: {
  supabase: GranaSupabaseClient
  userId: string
  parentId: string
}): Promise<CardMutationResult> {
  const { supabase, userId, parentId } = args

  const { data: parent, error: fetchError } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('is_parent', true)
    .single()

  if (fetchError || !parent) {
    return { ok: false, messageKey: 'cards.errors.installment_not_found' }
  }

  const { data: paidChild } = await supabase
    .from('transactions')
    .select('id')
    .eq('parent_id', parentId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (paidChild) {
    return { ok: false, messageKey: 'cards.errors.installment_delete_paid' }
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', parentId)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}
