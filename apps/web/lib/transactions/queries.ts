import type { DbClient } from '@/lib/supabase/db-client'
import { getSubcategoriesByCategoryId } from '@/lib/categories/queries'
import {
  getMonthCategoryBreakdown as getMonthCategoryBreakdownShared,
  UNCATEGORIZED_ID,
  type MonthCategoryBreakdown,
} from '@grana/dashboard'
import {
  computeCategoryNet,
  type CategoryAggRow,
  type CategorySliceInput,
  type SubcategorySliceInput,
} from '@grana/money-logic'
import { Money } from '@grana/validation'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  resolveMonthRange,
  type MovementFilters,
} from './filters'

export { UNCATEGORIZED_ID, type MonthCategoryBreakdown }
import { toFinancialMovement, type FinancialMovement } from './movements'
import type { TransactionCategory, TransactionWithDetails } from './types'

const TRANSACTION_SELECT = `
  *,
  category:categories(id, name, canonical_name, color, icon, user_id),
  subcategory:subcategories(id, name, canonical_name, category_id, user_id),
  destination_account:accounts!transactions_transfer_destination_account_id_fkey(id, name, type, institution:institutions(name)),
  source_account:accounts!transactions_account_id_fkey(id, name, type, institution:institutions(name)),
  period_payments(
    id,
    period_id,
    period:card_periods(
      id,
      start_date,
      end_date,
      due_date,
      account:accounts(id, name, type)
    )
  )
`

// Reimbursements derive their category from the linked expense. PostgREST can't
// reliably embed a self-referential FK (transactions → transactions), so we
// stitch it in a second query (same approach grana-v2 used for cashback).
// Only the per-row detail reads still need this — the global movements page
// gets the linked expense embedded by the get_movements_page RPC.
async function attachLinkedExpenses(
  supabase: DbClient,
  rows: TransactionWithDetails[],
): Promise<TransactionWithDetails[]> {
  const linkedIds = [
    ...new Set(
      rows
        .filter((r) => r.type === 'reimbursement' && r.linked_transaction_id)
        .map((r) => r.linked_transaction_id as string),
    ),
  ]
  if (linkedIds.length === 0) return rows

  const { data } = await supabase
    .from('transactions')
    .select('id, description, amount, currency_code, date, category:categories(id, name, canonical_name, color, icon, user_id), subcategory:subcategories(id, name, canonical_name, category_id, user_id)')
    .in('id', linkedIds)

  type LinkedExpense = NonNullable<TransactionWithDetails['linked_expense']>
  const map = new Map<string, LinkedExpense>()
  for (const e of (data ?? []) as unknown as LinkedExpense[]) {
    map.set(e.id, {
      id: e.id,
      description: e.description,
      amount: e.amount,
      currency_code: e.currency_code,
      date: e.date,
      category: e.category,
      subcategory: e.subcategory,
    })
  }

  return rows.map((r) =>
    r.type === 'reimbursement' && r.linked_transaction_id
      ? { ...r, linked_expense: map.get(r.linked_transaction_id) ?? null }
      : r,
  )
}

// A pending reimbursement is an expectation, not history: it lives in the
// "A confirmar" block, not in the chronological list. Cancelled ones are hidden
// too. Only RECEIVED reimbursements are facts that belong in the history.
const isHistoryRow = (r: TransactionWithDetails): boolean =>
  r.type !== 'reimbursement' || (r.received_at != null && r.cancelled_at == null)

// ── getTransactions ───────────────────────────────────────────────────────────

export async function getTransactions(
  supabase: DbClient,
  accountId: string,
  options: { limit?: number; offset?: number; currencyCode?: 'ARS' | 'USD' } = {},
): Promise<TransactionWithDetails[]> {
  const { limit = 20, offset = 0, currencyCode } = options

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .or(`account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (currencyCode) {
    query = query.eq('currency_code', currencyCode)
  }

  const { data, error } = await query

  if (error) throw error

  return attachLinkedExpenses(
    supabase,
    ((data ?? []) as unknown as TransactionWithDetails[]).filter(isHistoryRow),
  )
}

// ── getAccountMovementsAscending ──────────────────────────────────────────────
// All movements affecting an account, in calculation order (date/created_at/id
// ASC). No pagination, no filtering: the running balance needs the full history
// to be correct, and /accounts/[id] applies the user-facing filters + slice
// client-side over this dataset (the visible page and the balance share the
// same underlying data — TanStack caches one fetch, not two).

export async function getAccountMovementsAscending(
  supabase: DbClient,
  accountId: string,
): Promise<TransactionWithDetails[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .or(`account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error

  return attachLinkedExpenses(
    supabase,
    ((data ?? []) as unknown as TransactionWithDetails[]).filter(isHistoryRow),
  )
}

// ── getTransactionDetail ──────────────────────────────────────────────────────

export async function getGlobalMovements(
  supabase: DbClient,
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<FinancialMovement[]> {
  const page = await getGlobalMovementsPage(supabase, options)
  return page.movements
}

// ── hasAnyTransaction ─────────────────────────────────────────────────────────
// Lightweight check used by the empty-state copy in `/transactions`. Decides
// between the welcome variant (first-time user) and the month-vacío variant
// (user has history elsewhere, just navigated to an empty month). LIMIT 1 so
// the cost is constant regardless of dataset size.

export async function hasAnyTransaction(supabase: DbClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// The whole page — filters, the isHistoryRow rule, the linked-expense
// self-join and the limit+1 lookahead — is resolved by the get_movements_page
// RPC in ONE round-trip (migration 0029). This function only translates the
// MovementFilters contract to the RPC's jsonb input and maps rows to
// FinancialMovement.

export async function getGlobalMovementsPage(
  supabase: DbClient,
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<{
  movements: FinancialMovement[]
  hasMore: boolean
  nextLimit: number
}> {
  const { limit = DEFAULT_MOVEMENTS_LIMIT, offset = 0, filters = {} } = options

  // Period resolution: an explicit custom range (`from`/`to`) wins; otherwise
  // the selected `month` (`YYYY-MM`) resolves to its date range here — the
  // query owns this translation (the `MovementFilters` contract sends the raw
  // month), so the list and the per-month breakdowns slice the same window.
  const monthRange =
    !filters.from && !filters.to && filters.month ? resolveMonthRange(filters.month) : null

  const { data, error } = await supabase.rpc('get_movements_page', {
    p_filters: {
      from: filters.from ?? monthRange?.from,
      to: filters.to ?? monthRange?.to,
      categoryId: filters.categoryId,
      subcategoryId: filters.subcategoryId,
      currency: filters.currency,
      accountId: filters.accountId,
      type: filters.type,
      query: filters.query,
      amountMin: filters.amountMin,
      amountMax: filters.amountMax,
    },
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error

  const rows = (data ?? []) as unknown as TransactionWithDetails[]

  return {
    movements: rows.slice(0, limit).map(toFinancialMovement),
    hasMore: rows.length > limit && limit < MAX_MOVEMENTS_LIMIT,
    nextLimit: Math.min(limit + MOVEMENTS_LIMIT_STEP, MAX_MOVEMENTS_LIMIT),
  }
}

export async function getMovementFilterOptions(
  supabase: DbClient,
  options: { categoryId?: string } = {},
): Promise<{
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{
    id: string
    name: string
    type: 'income' | 'expense' | 'both'
    canonical_name: string
    user_id: string | null
  }>
  /** Subcategories of the active category, or [] when no category is filtered. */
  subcategories: Array<{
    id: string
    name: string
    category_id: string
    canonical_name: string
    user_id: string | null
  }>
}> {
  const [accountsResult, categoriesResult, subcategories] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, type, canonical_name, user_id')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    options.categoryId
      ? getSubcategoriesByCategoryId(supabase, options.categoryId)
      : Promise.resolve([]),
  ])

  if (accountsResult.error) throw accountsResult.error
  if (categoriesResult.error) throw categoriesResult.error

  return {
    accounts: (accountsResult.data ?? []) as Array<{
      id: string
      name: string
      type: 'cash' | 'bank' | 'credit'
    }>,
    categories: (categoriesResult.data ?? []) as Array<{
      id: string
      name: string
      type: 'income' | 'expense' | 'both'
      canonical_name: string
      user_id: string | null
    }>,
    subcategories: subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      category_id: s.category_id,
      canonical_name: s.canonical_name,
      user_id: s.user_id,
    })),
  }
}

export async function getTransactionDetail(
  supabase: DbClient,
  id: string,
): Promise<TransactionWithDetails | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const [enriched] = await attachLinkedExpenses(supabase, [
    data as unknown as TransactionWithDetails,
  ])
  return enriched ?? null
}

// ── getInstallmentFamily ──────────────────────────────────────────────────────
// Returns parent + all child rows for a given parent_id (or null if not found)

export async function getInstallmentFamily(
  supabase: DbClient,
  parentId: string,
): Promise<{
  parent: TransactionWithDetails | null
  children: TransactionWithDetails[]
}> {
  const [parentResult, childrenResult] = await Promise.all([
    supabase.from('transactions').select(TRANSACTION_SELECT).eq('id', parentId).single(),
    supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .eq('parent_id', parentId)
      .order('installment_n', { ascending: true }),
  ])

  if (parentResult.error && parentResult.error.code !== 'PGRST116') throw parentResult.error
  if (childrenResult.error) throw childrenResult.error

  return {
    parent: parentResult.error ? null : (parentResult.data as unknown as TransactionWithDetails),
    children: (childrenResult.data ?? []) as unknown as TransactionWithDetails[],
  }
}

// ── getPendingReimbursements ───────────────────────────────────────────────────
// Pending reimbursements (expected, not yet received nor cancelled), surfaced in
// the "A confirmar" block. Optionally scoped to one account (its account detail).

export type PendingReimbursementVM = {
  id: string
  target: 'account' | 'statement'
  estimatedAmount: number
  currencyCode: 'ARS' | 'USD'
  accountId: string | null
  accountName: string | null
  cardPeriodId: string | null
  categoryName: string | null
  /** Translation handles: system categories render `categories.{canonical_name}`. */
  categoryCanonicalName: string | null
  categoryIsSystem: boolean
  categoryIcon: string | null
  categoryColor: string | null
  expenseDescription: string | null
  /** Date of the linked consumption — the default date when confirming. */
  expenseDate: string | null
}

export async function getPendingReimbursements(
  supabase: DbClient,
  accountId?: string,
): Promise<PendingReimbursementVM[]> {
  let query = supabase
    .from('transactions')
    .select(
      'id, reimbursement_target, estimated_amount, currency_code, account_id, card_period_id, linked_transaction_id, source_account:accounts!transactions_account_id_fkey(name)',
    )
    .eq('type', 'reimbursement')
    .is('received_at', null)
    .is('cancelled_at', null)
    .order('date', { ascending: true })

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    id: string
    reimbursement_target: 'account' | 'statement'
    estimated_amount: number
    currency_code: 'ARS' | 'USD'
    account_id: string | null
    card_period_id: string | null
    linked_transaction_id: string | null
    source_account: { name: string } | null
  }>

  // Derived category + description from the linked expenses (one batched query).
  const linkedIds = [
    ...new Set(rows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id))),
  ]
  const linkedMap = new Map<
    string,
    { description: string | null; date: string; category: TransactionCategory | null }
  >()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, description, date, category:categories(id, name, canonical_name, color, icon, user_id)')
      .in('id', linkedIds)
    for (const e of (linked ?? []) as unknown as Array<{
      id: string
      description: string | null
      date: string
      category: TransactionCategory | null
    }>) {
      linkedMap.set(e.id, { description: e.description, date: e.date, category: e.category })
    }
  }

  return rows.map((r) => {
    const linked = r.linked_transaction_id ? linkedMap.get(r.linked_transaction_id) : undefined
    return {
      id: r.id,
      target: r.reimbursement_target,
      estimatedAmount: r.estimated_amount,
      currencyCode: r.currency_code,
      accountId: r.account_id,
      accountName: r.source_account?.name ?? null,
      cardPeriodId: r.card_period_id,
      categoryName: linked?.category?.name ?? null,
      categoryCanonicalName: linked?.category?.canonical_name ?? null,
      categoryIsSystem: linked?.category != null && linked.category.user_id === null,
      categoryIcon: linked?.category?.icon ?? null,
      categoryColor: linked?.category?.color ?? null,
      expenseDescription: linked?.description ?? null,
      expenseDate: linked?.date ?? null,
    }
  })
}

// ── getReimbursementsForExpense ────────────────────────────────────────────────
// All reimbursements linked to an expense, in EVERY state (pending / received /
// cancelled), to show on the expense detail. Cancelled ones are otherwise
// invisible and unreachable.

export type ExpenseReimbursementVM = {
  id: string
  amount: number
  currencyCode: 'ARS' | 'USD'
  target: 'account' | 'statement'
  state: 'pending' | 'received' | 'cancelled'
  date: string
}

export async function getReimbursementsForExpense(
  supabase: DbClient,
  expenseId: string,
): Promise<ExpenseReimbursementVM[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, currency_code, reimbursement_target, received_at, cancelled_at, date')
    .eq('type', 'reimbursement')
    .eq('linked_transaction_id', expenseId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    currencyCode: r.currency_code as 'ARS' | 'USD',
    target: r.reimbursement_target as 'account' | 'statement',
    state: r.cancelled_at ? 'cancelled' : r.received_at ? 'received' : 'pending',
    date: r.date,
  }))
}

// ── getMonthCategoryBreakdown ──────────────────────────────────────────────────
// The implementation lives in `@grana/dashboard` (shared with mobile). Web wraps
// it to inject its server client; `UNCATEGORIZED_ID` and `MonthCategoryBreakdown`
// are re-exported above so existing callers don't need to change imports.

export async function getMonthCategoryBreakdown(
  supabase: DbClient,
  month: string,
): Promise<MonthCategoryBreakdown> {
  return getMonthCategoryBreakdownShared(supabase, month)
}

// Whether the user has any USD income/expense activity in the month. Drives the
// ARS/USD toggle visibility in the spending overview so it stays consistent
// across the Egresos/Ingresos modes (the toggle shouldn't appear/disappear just
// because you switched mode). A single lightweight count query (head: true).
export async function hasUsdActivityInMonth(
  supabase: DbClient,
  month: string,
): Promise<boolean> {
  const { from, to } = resolveMonthRange(month)
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('currency_code', 'USD')
    .in('type', ['income', 'expense'])
    .gte('date', from ?? '')
    .lte('date', to ?? '')
  if (error) throw error
  return (count ?? 0) > 0
}

// ── getMonthIncomeBreakdown ────────────────────────────────────────────────────
// Income by category for a month: the twin of getMonthCategoryBreakdown but for
// the "De dónde vino" (Ingresos) mode of the spending overview. Aggregates
// `type='income'` rows by category and currency. Deliberately does NOT include
// reimbursements: per the domain rules a reimbursement is `type='reimbursement'`
// and is never income (it derives an expense's category and only reduces spend),
// so mixing it here would double-count money already netted out of the egresos
// donut. Uncategorized income is bucketed under the `uncategorized` sentinel
// (the UI labels it via i18n).

export async function getMonthIncomeBreakdown(
  supabase: DbClient,
  month: string,
): Promise<MonthCategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, currency_code, amount')
    .eq('type', 'income')
    .gte('date', from ?? '')
    .lte('date', to ?? '')
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    category_id: string | null
    currency_code: string
    amount: number
  }>

  // Net per category and currency (income amounts are positive; Money keeps the
  // arithmetic exact instead of raw JS addition).
  const byCategory = new Map<string, { ARS: number; USD: number }>()
  for (const r of rows) {
    const id = r.category_id ?? UNCATEGORIZED_ID
    const currency = r.currency_code === 'USD' ? 'USD' : 'ARS'
    const entry = byCategory.get(id) ?? { ARS: 0, USD: 0 }
    entry[currency] = Money.toNumber(Money.add(Money.from(entry[currency]), Money.from(r.amount)))
    byCategory.set(id, entry)
  }

  const realIds = [...byCategory.keys()].filter((id) => id !== UNCATEGORIZED_ID)
  const categoryById = new Map<
    string,
    {
      name: string
      color: string | null
      icon: string | null
      canonical_name: string
      user_id: string | null
    }
  >()
  if (realIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color, icon, canonical_name, user_id')
      .in('id', realIds)
    for (const c of cats ?? []) {
      categoryById.set(c.id, {
        name: c.name,
        color: c.color,
        icon: c.icon,
        canonical_name: c.canonical_name,
        user_id: c.user_id,
      })
    }
  }

  const build = (currency: 'ARS' | 'USD'): CategorySliceInput[] => {
    const out: CategorySliceInput[] = []
    for (const [id, perCurrency] of byCategory.entries()) {
      const value = perCurrency[currency]
      if (value <= 0) continue
      const display = id === UNCATEGORIZED_ID ? null : categoryById.get(id)
      // Uncategorized label is left empty; the UI fills it (i18n). System
      // categories carry translation handles so consumers relabel via i18n.
      out.push({
        categoryId: id,
        label: display?.name ?? '',
        color: display?.color ?? null,
        icon: display?.icon ?? null,
        value,
        canonicalName: display?.canonical_name ?? null,
        isSystem: display != null && display.user_id === null,
      })
    }
    return out
  }

  return { ARS: build('ARS'), USD: build('USD') }
}

// ── getMonthSubcategoryBreakdown ───────────────────────────────────────────────
// Same logic as `getMonthCategoryBreakdown`, but scoped to one category and
// keyed by subcategory. Used when the user filters by a single category — the
// donut switches to show the in-category composition. Transactions without a
// subcategory aggregate under `SUBCATEGORY_UNCATEGORIZED_ID`; the UI labels
// it via i18n.

/** Marker used as the aggregation key for "no subcategory assigned" rows.
 *  Distinct from the URL marker SUBCATEGORY_NONE_MARKER to avoid collisions in
 *  the aggregation; the UI translates this to the URL marker for drill-down. */
export const SUBCATEGORY_UNCATEGORIZED_ID = '__no_subcategory__'

export type MonthSubcategoryBreakdown = {
  ARS: SubcategorySliceInput[]
  USD: SubcategorySliceInput[]
}

export async function getMonthSubcategoryBreakdown(
  supabase: DbClient,
  month: string,
  categoryId: string,
): Promise<MonthSubcategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  const [expensesResult, reimbursementsResult, categoryResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('subcategory_id, currency_code, amount, is_parent, period_payments(id)')
      .eq('type', 'expense')
      .eq('category_id', categoryId)
      .is('card_period_id', null) // off-ledger consistency with category breakdown
      .gte('date', from ?? '')
      .lte('date', to ?? ''),
    supabase
      .from('transactions')
      .select('amount, currency_code, linked_transaction_id, received_at, cancelled_at')
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from ?? '')
      .lte('date', to ?? ''),
    supabase.from('categories').select('color').eq('id', categoryId).single(),
  ])
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error
  // categoryResult error tolerated: a missing category just leaves the slice
  // color null and the UI falls back to a neutral palette.

  const parentCategoryColor = (categoryResult.data?.color as string | null) ?? null

  const expenseRows = (expensesResult.data ?? []) as unknown as Array<{
    subcategory_id: string | null
    currency_code: string
    amount: number
    is_parent: boolean
    period_payments: { id: string }[] | null
  }>
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as Array<{
    amount: number
    currency_code: string
    linked_transaction_id: string | null
    received_at: string | null
    cancelled_at: string | null
  }>

  // Reimbursements net against their linked expense's subcategory. Filter to
  // only those linked to expenses in the active category — others belong to a
  // different category breakdown.
  const linkedIds = [
    ...new Set(reimbRows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id))),
  ]
  const linkedSubcategoryById = new Map<string, { subcategoryId: string | null; categoryId: string | null }>()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, category_id, subcategory_id')
      .in('id', linkedIds)
    for (const e of linked ?? []) {
      linkedSubcategoryById.set(e.id, {
        subcategoryId: e.subcategory_id,
        categoryId: e.category_id,
      })
    }
  }

  // Reuse computeCategoryNet by feeding subcategoryId as the key (with a
  // sentinel for nulls). The function is agnostic to what the key means.
  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (e.is_parent) continue
    if ((e.period_payments?.length ?? 0) > 0) continue
    aggRows.push({
      categoryId: e.subcategory_id ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount: e.amount,
    })
  }
  for (const r of reimbRows) {
    const linked = r.linked_transaction_id ? linkedSubcategoryById.get(r.linked_transaction_id) : null
    if (!linked || linked.categoryId !== categoryId) continue
    aggRows.push({
      categoryId: linked.subcategoryId ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount: r.amount,
      received_at: r.received_at,
      cancelled_at: r.cancelled_at,
    })
  }

  const netBySubcategory = computeCategoryNet(aggRows)

  const realIds = [...netBySubcategory.keys()].filter((id) => id !== SUBCATEGORY_UNCATEGORIZED_ID)
  const subcategoryById = new Map<
    string,
    { name: string; canonical_name: string; user_id: string | null }
  >()
  if (realIds.length > 0) {
    const { data: subs } = await supabase
      .from('subcategories')
      .select('id, name, canonical_name, user_id')
      .in('id', realIds)
    for (const s of subs ?? []) {
      subcategoryById.set(s.id, {
        name: s.name,
        canonical_name: s.canonical_name,
        user_id: s.user_id,
      })
    }
  }

  const build = (currency: 'ARS' | 'USD'): SubcategorySliceInput[] => {
    const out: SubcategorySliceInput[] = []
    for (const [id, perCurrency] of netBySubcategory.entries()) {
      const value = perCurrency[currency].neto
      if (value <= 0) continue
      const isNone = id === SUBCATEGORY_UNCATEGORIZED_ID
      const display = isNone ? null : subcategoryById.get(id) ?? null
      out.push({
        subcategoryId: isNone ? null : id,
        // Label resolved by the UI for i18n. Real subcategories get their
        // name from the DB; the "Sin subcategoría" bucket comes back with
        // an empty label. System rows carry translation handles.
        label: display?.name ?? '',
        color: parentCategoryColor,
        icon: null,
        value,
        canonicalName: display?.canonical_name ?? null,
        isSystem: display != null && display.user_id === null,
      })
    }
    return out
  }

  return { ARS: build('ARS'), USD: build('USD') }
}
