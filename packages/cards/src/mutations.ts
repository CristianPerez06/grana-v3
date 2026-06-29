import type { GranaSupabaseClient } from '@grana/supabase'
import {
  formatDateISO,
  addDaysToISO,
  suggestNextPeriodDates,
} from '@grana/money-logic'
import {
  normalizeMoneyAmount,
  createCreditCardSchema,
  validateActionInput,
  type CreateCreditCardInput,
} from '@grana/validation'

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
