import type { GranaSupabaseClient } from '@grana/supabase'
import {
  Money,
  normalizeMoneyAmount,
  registerInstallmentsSchema,
  validateActionInput,
  type RegisterInstallmentsInput,
} from '@grana/validation'
import {
  addMonthsToISO,
  splitAmountIntoInstallments,
} from '@grana/money-logic'
import { applySharedSplits } from './internal/shared-splits'
import {
  getCardPeriodsWithStatus,
  getOrCreatePeriodForDate,
  CardPurchasePredatesHistoryError,
} from './internal/card-periods'

export type RegisterInstallmentsArgs = {
  supabase: GranaSupabaseClient
  /** The caller is responsible for auth: this is the verified user id. */
  userId: string
  input: unknown
  /** Current AR date — required because `getTodayAR` is not yet shared
   *  cross-platform (see task 7.6). Used by the rolling-period algorithm. */
  today: Date
}

export type RegisterInstallmentsResult =
  | { ok: true; parentId: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof RegisterInstallmentsInput, string>>
      formError?: string
    }

function normalizeMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

/** ISO date → DD/MM/AAAA for user-facing messages. */
function formatHistoryDate(iso: string): string {
  return iso.split('-').reverse().join('/')
}

/**
 * Orchestrator for the installment-purchase flow (cuotas en tarjeta).
 *
 * Phases (with rollback): validate → verify account → split + assign periods →
 * backdate guard → insert PARENT off-ledger → insert N CHILDREN → apply shared
 * splits (if any). Any failure after PARENT inserts triggers a manual rollback
 * (the package does not assume Postgres transactions, since the Supabase JS
 * client does not expose them; rollback is best-effort delete-by-id).
 *
 * Does NOT handle auth or cache invalidation. The caller (web server action or
 * mobile mutation hook) verifies the user, supplies the supabase client, and
 * invalidates its own caches after a successful return.
 */
export async function registerInstallments(
  args: RegisterInstallmentsArgs,
): Promise<RegisterInstallmentsResult> {
  const { supabase, userId, input, today } = args

  const validation = await validateActionInput(registerInstallmentsSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data
  const n = data.installments_total

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', data.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'Tarjeta no encontrada.' }
  }
  if (account.type !== 'credit') {
    return { ok: false, formError: 'Las cuotas solo aplican a tarjetas de crédito.' }
  }

  const normalizedAmount = normalizeMoney(data.amount)
  const installmentAmounts = splitAmountIntoInstallments(normalizedAmount, n)

  const installmentDates: string[] = []
  for (let i = 0; i < n; i++) {
    installmentDates.push(addMonthsToISO(data.date, i))
  }

  const periodIds: string[] = []
  for (const txDate of installmentDates) {
    try {
      const periodId = await getOrCreatePeriodForDate(
        supabase,
        data.account_id,
        txDate,
        today,
      )
      periodIds.push(periodId)
    } catch (e) {
      // Only the first installment uses the purchase date; later ones are
      // +N months (always forward). So this rejection means the purchase
      // itself predates the card's history — nothing has been inserted yet.
      if (e instanceof CardPurchasePredatesHistoryError) {
        return {
          ok: false,
          formError: `La fecha de la compra es anterior al primer resumen de la tarjeta (${formatHistoryDate(e.oldestStartDate)}). Grana registra consumos desde ese resumen en adelante.`,
        }
      }
      return {
        ok: false,
        formError: `No se pudo asignar un período para la cuota del ${txDate}.`,
      }
    }
  }

  const periods = await getCardPeriodsWithStatus(supabase, data.account_id)
  const paidPeriodIds = new Set(periods.filter((p) => p.has_payment).map((p) => p.id))
  for (const pid of periodIds) {
    if (paidPeriodIds.has(pid)) {
      return {
        ok: false,
        formError: 'Una o más cuotas caerían en un período ya pagado.',
      }
    }
  }

  const { data: parent, error: parentError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: null,
      type: 'expense',
      amount: normalizedAmount,
      currency_code: 'ARS',
      date: data.date,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      is_parent: true,
      installments_total: n,
      ...(data.shared ? { is_shared: true, household_id: data.shared.household_id } : {}),
    })
    .select('id')
    .single()

  if (parentError || !parent) {
    return { ok: false, formError: parentError?.message ?? 'Error al crear la compra.' }
  }

  const childRows = installmentAmounts.map((installmentMoney, i) => {
    const txDate = installmentDates[i]
    const periodId = periodIds[i]
    const period = periods.find((p) => p.id === periodId)

    return {
      user_id: userId,
      account_id: data.account_id,
      type: 'expense' as const,
      amount: Money.toNumber(installmentMoney),
      currency_code: 'ARS',
      date: txDate,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      is_parent: false,
      parent_id: parent.id,
      status: 'pending' as const,
      card_period_id: periodId,
      due_date: period?.due_date ?? null,
      installment_n: i + 1,
      installments_total: n,
    }
  })

  const { data: insertedChildren, error: childrenError } = await supabase
    .from('transactions')
    .insert(childRows)
    .select('id, amount')

  if (childrenError || !insertedChildren) {
    await supabase.from('transactions').delete().eq('id', parent.id)
    return { ok: false, formError: childrenError?.message ?? 'Error al crear las cuotas.' }
  }

  if (data.shared) {
    const s = await applySharedSplits(
      supabase,
      { household_id: data.shared.household_id, splits: data.shared.splits },
      insertedChildren.map((c) => ({ transactionId: c.id, amount: Number(c.amount) })),
    )
    if (!s.ok) {
      await supabase.from('transactions').delete().eq('parent_id', parent.id)
      await supabase.from('transactions').delete().eq('id', parent.id)
      return {
        ok: false,
        formError: `Las cuotas no se guardaron (compartido inválido): ${s.error}`,
      }
    }
  }

  return { ok: true, parentId: parent.id }
}
