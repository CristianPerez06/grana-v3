import type { Database, GranaSupabaseClient } from '@grana/supabase'
import { computePeriodAmounts, derivePeriodVariant, sumMoneyValues } from '@grana/money-logic'
import { getCardPeriodsWithStatus } from '@grana/transactions-mutations'
import { derivePeriodAlert, getCreditCardDebtCheck } from './queries'
import type {
  CardPeriodWithPayment,
  PeriodVariant,
  CardPeriodAlert,
  CreditCardDebtCheck,
} from './types'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// The card detail read layer (account detail, periods, period detail, active
// installments, networks, period tx count) lives here so the mobile detail
// route can reuse it. Like the rest of the slice, every read is client-agnostic
// (`supabase` first, `today: Date` injected by the caller) and the module never
// imports `next/*`, declares `'use server'`, creates a client, or revalidates.

// ─── Detail return types ───────────────────────────────────────────────────────

export type CardPeriodDetail = CardPeriodWithPayment & {
  variant: PeriodVariant
  alert: CardPeriodAlert
  pendingAmountARS: number
  pendingAmountUSD: number
  paidAmountARS: number
  paidAmountUSD: number
  /** Alícuota de sellos recordada de la tarjeta; null si todavía no se conoce. */
  stampTaxRate: number | null
  paymentDate: string | null
  /** Monto del gasto-débito del pago — lo que vuelve a la cuenta si se deshace. */
  paymentAmount: number | null
  /** Nombre de la cuenta desde la que se pagó. */
  paymentAccountName: string | null
  /**
   * El pago registró un impuesto de sellos vinculado. Solo es confiable para pagos
   * posteriores a la migración 0050; en los viejos el vínculo no existe y la
   * reversión resuelve el sello por heurística (ver `revertCardPeriodPayment`).
   */
  paymentHasStampTax: boolean
  paymentRecordId: string | null
  paymentExpenseId: string | null
  nextPeriodStart: string | null
  nextPeriodIsPaid: boolean
  transactions: Array<{
    id: string
    type: string
    amount: number
    currency_code: string
    date: string
    status: string | null
    description: string | null
    category_id: string | null
    is_parent: boolean
    installment_n: number | null
    installments_total: number | null
    fx_rate_to_ars: number | null
    received_at: string | null
    cancelled_at: string | null
    category?: {
      name: string
      icon: string | null
      color: string | null
      canonical_name: string
      user_id: string | null
    } | null
    subcategory?: { name: string; canonical_name: string; user_id: string | null } | null
  }>
}

export type CreditCardDetail = Tables<'accounts'> & {
  institution: Tables<'institutions'> | null
  currencies: Tables<'account_currencies'>[]
  periods: CardPeriodWithPayment[]
  today: Date
  debtCheck: CreditCardDebtCheck
}

export type ActiveInstallment = {
  /** Parent transaction id. */
  parentId: string
  /** Purchase name (description or category fallback). */
  name: string
  /** Purchase description as typed by the user, or null. */
  description: string | null
  /** Category name, or null. */
  categoryName: string | null
  /** Translation handles: system categories render `categories.{canonical_name}`. */
  categoryCanonicalName: string | null
  categoryIsSystem: boolean
  /** Purchase date (the parent's accounting date, ISO). */
  purchaseDate: string
  /** Installments already paid. */
  paidCount: number
  /** Total installments. */
  total: number
  /** Per-installment amount (ARS). */
  perInstallment: number
  /** Remaining amount (sum of pending children, ARS). */
  remaining: number
  /** Next pending installment due date (ISO), or null. */
  nextDueDate: string | null
}

export type ActiveInstallmentsResult = {
  items: ActiveInstallment[]
  /** Aggregate remaining across all active installment purchases (ARS). */
  totalRemaining: number
}

export type CardNetwork = Pick<
  Tables<'card_networks'>,
  'id' | 'slug' | 'name' | 'brand_color' | 'display_order'
>

// ─── getCreditCardDetail ───────────────────────────────────────────────────────

export async function getCreditCardDetail(
  supabase: GranaSupabaseClient,
  accountId: string,
  today: Date,
): Promise<CreditCardDetail | null> {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*, institution:institutions(*), currencies:account_currencies(*)')
    .eq('id', accountId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const periods = await getCardPeriodsWithStatus(supabase, accountId)
  const debtCheck = await getCreditCardDebtCheck(supabase, accountId, today)

  return {
    ...account,
    periods,
    today,
    debtCheck,
  }
}

// ─── getCardPeriods (historial) ────────────────────────────────────────────────

export async function getCardPeriods(
  supabase: GranaSupabaseClient,
  accountId: string,
  today: Date,
): Promise<CardPeriodDetail[]> {
  const periods = await getCardPeriodsWithStatus(supabase, accountId)
  if (periods.length === 0) return []

  const periodIds = periods.map((p) => p.id)

  // Alícuota de sellos de la tarjeta (la misma para todos sus períodos).
  const { data: accountRow, error: accountRowError } = await supabase
    .from('accounts')
    .select('stamp_tax_rate')
    .eq('id', accountId)
    .maybeSingle()
  if (accountRowError) throw accountRowError
  const stampTaxRate = accountRow?.stamp_tax_rate ?? null

  // Load transactions grouped by period
  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select('id, type, card_period_id, amount, currency_code, date, status, description, category_id, is_parent, installment_n, installments_total, fx_rate_to_ars, received_at, cancelled_at, category:categories(name, icon, color, canonical_name, user_id), subcategory:subcategories(name, canonical_name, user_id)')
    .in('card_period_id', periodIds)
    .eq('is_parent', false)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (txError) throw txError

  // Load payment details
  const paidPeriodIds = periods.filter((p) => p.has_payment).map((p) => p.id)
  const { data: paymentRows, error: paymentError } = paidPeriodIds.length > 0
    ? await supabase
        .from('period_payments')
        .select(
          'id, period_id, transaction_id, stamp_tax_transaction_id, transactions!transaction_id(date, amount, account:accounts!transactions_account_id_fkey(name))',
        )
        .in('period_id', paidPeriodIds)
    : { data: [], error: null }

  if (paymentError) throw paymentError

  type PaymentInfo = {
    date: string | null
    amount: number | null
    accountName: string | null
    hasStampTax: boolean
    recordId: string
    expenseId: string
  }
  const paymentByPeriod = new Map<string, PaymentInfo>()
  for (const p of paymentRows ?? []) {
    const tx = p.transactions as unknown as
      | { date: string; amount: number | string; account: { name: string } | null }
      | null
    paymentByPeriod.set(p.period_id, {
      date: tx?.date ?? null,
      amount: tx ? Number(tx.amount) : null,
      accountName: tx?.account?.name ?? null,
      hasStampTax: p.stamp_tax_transaction_id != null,
      recordId: p.id,
      expenseId: p.transaction_id,
    })
  }

  // Index next period (by chronological asc) before reversing for display order.
  const nextByPeriodId = new Map<string, { start_date: string; has_payment: boolean }>()
  for (let i = 0; i < periods.length - 1; i++) {
    nextByPeriodId.set(periods[i].id, {
      start_date: periods[i + 1].start_date,
      has_payment: periods[i + 1].has_payment,
    })
  }

  return periods.reverse().map((period) => {
    const periodTxs = (txRows ?? [])
      .filter((t) => t.card_period_id === period.id)
      // Only RECEIVED reimbursements belong in the statement (they reduce it);
      // pending/cancelled ones are not part of the resumen.
      .filter(
        (t) =>
          t.type !== 'reimbursement' || (t.received_at != null && t.cancelled_at == null),
      )

    // Statement totals per currency. A received "en resumen" reimbursement
    // reduces whichever total the statement shows (paid when paid, else pending).
    const amounts = computePeriodAmounts(periodTxs, period.has_payment)
    const paymentInfo = paymentByPeriod.get(period.id)
    const nextInfo = nextByPeriodId.get(period.id) ?? null

    return {
      ...period,
      variant: derivePeriodVariant(period, today, period.has_payment, period.tx_count),
      alert: derivePeriodAlert(period, today, period.has_payment),
      pendingAmountARS: amounts.pendingAmountARS,
      pendingAmountUSD: amounts.pendingAmountUSD,
      paidAmountARS: amounts.paidAmountARS,
      paidAmountUSD: amounts.paidAmountUSD,
      stampTaxRate,
      paymentDate: paymentInfo?.date ?? null,
      paymentAmount: paymentInfo?.amount ?? null,
      paymentAccountName: paymentInfo?.accountName ?? null,
      paymentHasStampTax: paymentInfo?.hasStampTax ?? false,
      paymentRecordId: paymentInfo?.recordId ?? null,
      paymentExpenseId: paymentInfo?.expenseId ?? null,
      nextPeriodStart: nextInfo?.start_date ?? null,
      nextPeriodIsPaid: nextInfo?.has_payment ?? false,
      transactions: periodTxs,
    }
  })
}

// ─── getCardPeriodDetail ───────────────────────────────────────────────────────

export async function getCardPeriodDetail(
  supabase: GranaSupabaseClient,
  periodId: string,
  today: Date,
): Promise<CardPeriodDetail | null> {
  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('*')
    .eq('id', periodId)
    .single()

  if (periodError) {
    if (periodError.code === 'PGRST116') return null
    throw periodError
  }

  const [periodsWithStatus, txResult, paymentResult, accountResult] = await Promise.all([
    getCardPeriodsWithStatus(supabase, period.account_id),
    supabase
      .from('transactions')
      .select('id, type, card_period_id, amount, currency_code, date, status, description, category_id, is_parent, installment_n, installments_total, fx_rate_to_ars, received_at, cancelled_at, category:categories(name, icon, color, canonical_name, user_id), subcategory:subcategories(name, canonical_name, user_id)')
      .eq('card_period_id', periodId)
      .eq('is_parent', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('period_payments')
      .select(
        'id, period_id, transaction_id, stamp_tax_transaction_id, transactions!transaction_id(date, amount, account:accounts!transactions_account_id_fkey(name))',
      )
      .eq('period_id', periodId)
      .maybeSingle(),
    supabase
      .from('accounts')
      .select('stamp_tax_rate')
      .eq('id', period.account_id)
      .maybeSingle(),
  ])

  if (txResult.error) throw txResult.error
  if (paymentResult.error) throw paymentResult.error
  if (accountResult.error) throw accountResult.error

  const periodWithPayment = periodsWithStatus.find((p) => p.id === periodId)
  if (!periodWithPayment) return null

  const nextPeriod = periodsWithStatus
    .filter((p) => p.start_date > periodWithPayment.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null

  const txRows = (txResult.data ?? []).filter(
    (t) => t.type !== 'reimbursement' || (t.received_at != null && t.cancelled_at == null),
  )
  // Statement totals per currency. A received "en resumen" reimbursement reduces
  // whichever total the statement shows (paid when paid, else pending).
  const amounts = computePeriodAmounts(txRows, periodWithPayment.has_payment)

  const payment = paymentResult.data
  const paymentTx = payment?.transactions as unknown as
    | { date: string; amount: number | string; account: { name: string } | null }
    | null
  const paymentTxDate = paymentTx?.date ?? null

  return {
    ...periodWithPayment,
    variant: derivePeriodVariant(periodWithPayment, today, periodWithPayment.has_payment, periodWithPayment.tx_count),
    alert: derivePeriodAlert(periodWithPayment, today, periodWithPayment.has_payment),
    pendingAmountARS: amounts.pendingAmountARS,
    pendingAmountUSD: amounts.pendingAmountUSD,
    paidAmountARS: amounts.paidAmountARS,
    paidAmountUSD: amounts.paidAmountUSD,
    stampTaxRate: accountResult.data?.stamp_tax_rate ?? null,
    paymentDate: paymentTxDate,
    paymentAmount: paymentTx ? Number(paymentTx.amount) : null,
    paymentAccountName: paymentTx?.account?.name ?? null,
    paymentHasStampTax: payment?.stamp_tax_transaction_id != null,
    paymentRecordId: payment?.id ?? null,
    paymentExpenseId: payment?.transaction_id ?? null,
    nextPeriodStart: nextPeriod?.start_date ?? null,
    nextPeriodIsPaid: nextPeriod?.has_payment ?? false,
    transactions: txRows,
  }
}

// ─── getActiveInstallments (cuotas en curso) per card ──────────────────────────

/**
 * Active installment purchases for a card: every parent (`is_parent=true`) with
 * at least one pending child on this card. Installments are ARS-only
 * (`I-CRED-9`). For each purchase, derive paid/total, per-installment amount,
 * remaining (sum of pending children) and the next pending due date.
 */
export async function getActiveInstallments(
  supabase: GranaSupabaseClient,
  accountId: string,
): Promise<ActiveInstallmentsResult> {
  // All installment children on this card (parent_id set). Children carry
  // account_id=card; the parent is off-ledger and fetched in a second query —
  // PostgREST can't reliably embed a self-referential FK (same caveat as the
  // reimbursement → linked expense stitch), and the broken embed made the UI
  // fall back to an arbitrary child's date as the "purchase date".
  const { data: children, error } = await supabase
    .from('transactions')
    .select(
      'id, parent_id, amount, status, date, due_date, installment_n, installments_total',
    )
    .eq('account_id', accountId)
    .eq('is_parent', false)
    .not('parent_id', 'is', null)
    .eq('currency_code', 'ARS')

  if (error) throw error
  if (!children || children.length === 0) return { items: [], totalRemaining: 0 }

  type Child = (typeof children)[number]
  const byParent = new Map<string, Child[]>()
  for (const child of children) {
    if (!child.parent_id) continue
    const list = byParent.get(child.parent_id) ?? []
    list.push(child)
    byParent.set(child.parent_id, list)
  }

  // Stitch the parents (purchase identity: description, purchase date, category).
  const { data: parents, error: parentsError } = await supabase
    .from('transactions')
    .select('id, description, date, category:categories(name, canonical_name, user_id)')
    .in('id', [...byParent.keys()])

  if (parentsError) throw parentsError
  type ParentRow = {
    id: string
    description: string | null
    date: string
    category: { name: string; canonical_name: string; user_id: string | null } | null
  }
  const parentById = new Map<string, ParentRow>(
    ((parents ?? []) as unknown as ParentRow[]).map((p) => [p.id, p]),
  )

  const items: ActiveInstallment[] = []
  for (const [parentId, group] of byParent) {
    // Only "active" purchases: at least one pending child remains.
    const pending = group.filter((c) => c.status === 'pending')
    if (pending.length === 0) continue

    const parent = parentById.get(parentId) ?? null
    const firstChild =
      [...group].sort((a, b) => (a.installment_n ?? 0) - (b.installment_n ?? 0))[0]
    const paidCount = group.filter((c) => c.status === 'paid').length
    const total = group[0].installments_total ?? group.length
    const perInstallment = Number(group[0].amount)
    const remaining = sumMoneyValues(pending.map((c) => c.amount))
    const nextDueDate =
      [...pending]
        .sort((a, b) => (a.installment_n ?? 0) - (b.installment_n ?? 0))[0]?.due_date ?? null

    items.push({
      parentId,
      name: parent?.description ?? parent?.category?.name ?? 'Compra en cuotas',
      description: parent?.description ?? null,
      categoryName: parent?.category?.name ?? null,
      categoryCanonicalName: parent?.category?.canonical_name ?? null,
      categoryIsSystem: parent?.category != null && parent.category.user_id === null,
      // Fallback: first cuota's date (≈ purchase date), never an arbitrary one.
      purchaseDate: parent?.date ?? firstChild.date,
      paidCount,
      total,
      perInstallment,
      remaining,
      nextDueDate,
    })
  }

  // Most recent purchase first.
  items.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))

  return {
    items,
    totalRemaining: sumMoneyValues(items.map((i) => i.remaining)),
  }
}

// ─── getCardPeriodTransactionCount ─────────────────────────────────────────────

export async function getCardPeriodTransactionCount(
  supabase: GranaSupabaseClient,
  periodId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_period_id', periodId)
    .eq('is_parent', false)

  if (error) throw error
  return count ?? 0
}

// ─── getCardNetworks ───────────────────────────────────────────────────────────

export async function getCardNetworks(supabase: GranaSupabaseClient): Promise<CardNetwork[]> {
  const { data, error } = await supabase
    .from('card_networks')
    .select('id, slug, name, brand_color, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}
