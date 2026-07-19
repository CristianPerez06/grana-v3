import type { DbClient } from '@/lib/supabase/db-client'
import { getSubcategoriesByCategoryId } from '@/lib/categories/queries'
import {
  getMonthCategoryBreakdown as getMonthCategoryBreakdownShared,
  UNCATEGORIZED_ID,
  type MonthCategoryBreakdown,
} from '@grana/dashboard'
import {
  categoryOwnPortion,
  computeCategoryNet,
  countsAsCategorySpend,
  type CategoryAggRow,
  type CategorySliceInput,
  type SubcategorySliceInput,
} from '@grana/money-logic'
import { Money } from '@grana/validation'
import { resolveAccountAvatar, type ResolvedAccountAvatar } from '@grana/ui-contracts'
import {
  getAccountMovementsAscending,
  getPendingReimbursements,
  TRANSACTION_SELECT,
  attachLinkedExpenses,
  isHistoryRow,
  toFinancialMovement,
  SUBCATEGORY_NONE_MARKER,
  type FinancialMovement,
} from '@grana/transactions'
import { resolveMonthRange } from './filters'

export { UNCATEGORIZED_ID, type MonthCategoryBreakdown }
import type { TransactionWithDetails } from './types'

// The account-scoped read slice (movements list + pending reimbursements) and
// its `PendingReimbursementVM` type now live in `@grana/transactions` so mobile
// can reuse them. Re-exported here so existing call sites keep their imports and
// the `accountMovementsAscending` / `accountPendingReimbursements` query keys
// stay unchanged. The shared select shape and helpers (`TRANSACTION_SELECT`,
// `attachLinkedExpenses`, `isHistoryRow`) are imported above and reused by the
// web-retained feed reads below.
export { getAccountMovementsAscending, getPendingReimbursements }
export type { PendingReimbursementVM } from '@grana/transactions'

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

// ── Global movements feed ─────────────────────────────────────────────────────
// `getGlobalMovements`, `getGlobalMovementsPage` and `hasAnyTransaction` now live
// in `@grana/transactions` (the mobile Movimientos tab is the second consumer).
// Re-exported here so web keeps importing them from `@/lib/transactions/queries`
// unchanged — same RPC (`get_movements_page`), same pagination, same query keys.
export { getGlobalMovements, getGlobalMovementsPage, hasAnyTransaction } from '@grana/transactions'

// The transaction-graph detail reads (detail + installment family + expense
// reimbursements) now live in `@grana/transactions` (the mobile `/transactions/[txId]`
// screen is the second consumer). Re-exported here so web keeps importing them from
// `@/lib/transactions/queries` unchanged — same select shape and RLS path.
export {
  getTransactionDetail,
  getInstallmentFamily,
  getReimbursementsForExpense,
} from '@grana/transactions'
export type { ExpenseReimbursementVM } from '@grana/transactions'

export async function getMovementFilterOptions(
  supabase: DbClient,
  options: { categoryId?: string } = {},
): Promise<{
  accounts: Array<{
    id: string
    name: string
    type: 'cash' | 'bank' | 'credit'
    avatar: ResolvedAccountAvatar
  }>
  categories: Array<{
    id: string
    name: string
    type: 'income' | 'expense' | 'both'
    canonical_name: string
    user_id: string | null
    icon: string | null
    color: string | null
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
      .select('id, name, type, color_key, icon_key, institution:institutions(brand_color, icon_type)')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, type, canonical_name, user_id, icon, color')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    options.categoryId
      ? getSubcategoriesByCategoryId(supabase, options.categoryId)
      : Promise.resolve([]),
  ])

  if (accountsResult.error) throw accountsResult.error
  if (categoriesResult.error) throw categoriesResult.error

  const accountRows = (accountsResult.data ?? []) as unknown as Array<{
    id: string
    name: string
    type: 'cash' | 'bank' | 'credit'
    color_key: string | null
    icon_key: string | null
    institution: { brand_color: string | null; icon_type: string | null } | null
  }>

  return {
    accounts: accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      avatar: resolveAccountAvatar(a, a.institution),
    })),
    categories: (categoriesResult.data ?? []) as Array<{
      id: string
      name: string
      type: 'income' | 'expense' | 'both'
      canonical_name: string
      user_id: string | null
      icon: string | null
      color: string | null
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

// ── getMonthCategoryLines (drilled reconciliation list) ────────────────────────
// The rows that COMPOSE a category's weight in the "En qué se fue" donut for a
// month + currency. Uses the SAME devengado lens as `getMonthCategoryBreakdown`
// (shared helpers `countsAsCategorySpend` / `categoryOwnPortion`), so the sum of
// the rows' displayed amounts equals the donut weight BY CONSTRUCTION — the
// `category-lens` reconcile test guards the helpers against drift.
//
//   - installment CHILDREN by their due month (not the off-ledger parent);
//   - shared movements at the USER's part (`amount` overridden to her split);
//   - shared with no own part (100% the other member) omitted;
//   - received reimbursements of the category as their own inflow rows — they
//     net the spend down (expense sign '-' + reimbursement sign '+' → the
//     signed sum is the weight);
//   - statement payment excluded.
//
// Optionally narrows to a subcategory (the in-category drill). This is a
// DRILL-ONLY view: unlike the general feed (`get_movements_page`, CAJA lens) it
// shows children and the user's part, and never replaces the general list.

export type MonthCategoryLines = {
  movements: FinancialMovement[]
  /** Cuota position per child-installment movement id, for the "Cuota n de N" chip. */
  installments: Map<string, { n: number; total: number }>
}

export async function getMonthCategoryLines(
  supabase: DbClient,
  month: string,
  categoryId: string,
  currency: 'ARS' | 'USD',
  subcategoryId?: string,
): Promise<MonthCategoryLines> {
  const { from, to } = resolveMonthRange(month)
  const isUncategorized = categoryId === UNCATEGORIZED_ID

  // Expenses of the category in the month (devengado): normal + card consumos +
  // cuota CHILDREN (their date lands in the month). No status filter — children
  // carry status='pending'/'paid'. The parent is fetched only if its purchase
  // date is in the month, and skipped by the lens below.
  let expenseQuery = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('type', 'expense')
    .eq('currency_code', currency)
    .gte('date', from ?? '')
    .lte('date', to ?? '')
  expenseQuery = isUncategorized
    ? expenseQuery.is('category_id', null)
    : expenseQuery.eq('category_id', categoryId)
  if (subcategoryId) {
    expenseQuery =
      subcategoryId === SUBCATEGORY_NONE_MARKER
        ? expenseQuery.is('subcategory_id', null)
        : expenseQuery.eq('subcategory_id', subcategoryId)
  }

  // Received (not cancelled) reimbursements in the month; their category is
  // DERIVED from the linked expense, so fetch broadly then filter below.
  const reimbQuery = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('type', 'reimbursement')
    .eq('currency_code', currency)
    .not('received_at', 'is', null)
    .is('cancelled_at', null)
    .gte('date', from ?? '')
    .lte('date', to ?? '')

  const [expenseResult, reimbResult] = await Promise.all([expenseQuery, reimbQuery])
  if (expenseResult.error) throw expenseResult.error
  if (reimbResult.error) throw reimbResult.error

  const expenseRows = (expenseResult.data ?? []) as unknown as TransactionWithDetails[]
  const reimbRowsAll = await attachLinkedExpenses(
    supabase,
    (reimbResult.data ?? []) as unknown as TransactionWithDetails[],
  )
  // Keep only reimbursements whose linked expense sits in this category (and
  // subcategory, when drilling) — mirrors the donut's derived-category netting.
  const targetCategory = isUncategorized ? null : categoryId
  const reimbRows = reimbRowsAll.filter((r) => {
    const linkedCat = r.linked_expense?.category?.id ?? null
    if (linkedCat !== targetCategory) return false
    if (!subcategoryId) return true
    const linkedSub = r.linked_expense?.subcategory?.id ?? null
    return subcategoryId === SUBCATEGORY_NONE_MARKER ? linkedSub === null : linkedSub === subcategoryId
  })

  // The user's part for shared rows (household "cuenta corriente"). The split
  // RLS exposes both members, so filter by her uid explicitly.
  const sharedIds = [
    ...new Set([
      ...expenseRows.filter((e) => e.is_shared).map((e) => e.id),
      ...reimbRows.filter((r) => r.is_shared).map((r) => r.id),
    ]),
  ]
  const mySplitByTx = new Map<string, number>()
  if (sharedIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: splits } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .eq('user_id', user.id)
        .in('transaction_id', sharedIds)
      for (const s of splits ?? [])
        mySplitByTx.set(s.transaction_id as string, Number(s.amount_assigned))
    }
  }

  const movements: FinancialMovement[] = []
  const installments = new Map<string, { n: number; total: number }>()

  const pushLine = (tx: TransactionWithDetails, share: number) => {
    const mv = toFinancialMovement(tx)
    // Show the user's part: override the amount the row displays (and thus the
    // reconciliation sum) to her share. Non-shared → share === full amount.
    movements.push({ ...mv, amount: Math.abs(share) })
    if (tx.installment_n != null && tx.installments_total != null) {
      installments.set(tx.id, { n: tx.installment_n, total: tx.installments_total })
    }
  }

  for (const e of expenseRows) {
    if (
      !countsAsCategorySpend({
        is_parent: e.is_parent,
        hasStatementPayment: (e.period_payments?.length ?? 0) > 0,
      })
    )
      continue
    const share = categoryOwnPortion(e, mySplitByTx)
    if (share === null) continue // shared with no own part → not ours
    pushLine(e, share)
  }
  for (const r of reimbRows) {
    const share = categoryOwnPortion(r, mySplitByTx)
    if (share === null) continue
    pushLine(r, share)
  }

  // Feed order: date desc, then created_at/id desc — same as the global feed.
  movements.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  )

  return { movements, installments }
}

// Whether the user operates in USD at all — i.e. has at least one account with a
// USD currency row (bimoneda). Drives the ARS/USD toggle in the spending
// overview so it shows on every month for bimoneda users, not only on months
// that happen to have USD movements. User-level, month-independent; a single
// lightweight count query (head: true), RLS-scoped to the user's accounts.
export async function hasUsdAccount(supabase: DbClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('account_currencies')
    .select('account_id', { count: 'exact', head: true })
    .eq('currency_code', 'USD')
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

  // Income is always positive, so it never produces credits (those only arise
  // from reimbursements netting against spend). The field is empty by construction.
  return { ARS: build('ARS'), USD: build('USD'), credits: { ARS: [], USD: [] } }
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
      .select('id, subcategory_id, currency_code, amount, is_parent, is_shared, period_payments!period_payments_transaction_id_fkey(id)')
      .eq('type', 'expense')
      .eq('category_id', categoryId)
      // Devengado: include card consumos/cuotas by their date (consistent with
      // the category breakdown). The loop still skips the installment parent
      // (is_parent) and statement payments (period_payments).
      .gte('date', from ?? '')
      .lte('date', to ?? ''),
    supabase
      .from('transactions')
      .select('id, amount, currency_code, linked_transaction_id, received_at, cancelled_at, is_shared')
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
    id: string
    subcategory_id: string | null
    currency_code: string
    amount: number
    is_parent: boolean
    is_shared: boolean
    period_payments: { id: string }[] | null
  }>
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as Array<{
    id: string
    amount: number
    currency_code: string
    linked_transaction_id: string | null
    received_at: string | null
    cancelled_at: string | null
    is_shared: boolean
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
  // Shared movements count only the user's portion (household "cuenta
  // corriente"), same rule as getMonthCategoryBreakdown. The split RLS exposes
  // both members' rows, so filter by her uid explicitly.
  const sharedIds = [
    ...new Set([
      ...expenseRows.filter((e) => e.is_shared).map((e) => e.id),
      ...reimbRows.filter((r) => r.is_shared).map((r) => r.id),
    ]),
  ]
  const mySplitByTx = new Map<string, number>()
  if (sharedIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: splits } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .eq('user_id', user.id)
        .in('transaction_id', sharedIds)
      for (const s of splits ?? [])
        mySplitByTx.set(s.transaction_id as string, Number(s.amount_assigned))
    }
  }
  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (!countsAsCategorySpend({
      is_parent: e.is_parent,
      hasStatementPayment: (e.period_payments?.length ?? 0) > 0,
    })) continue
    const amount = categoryOwnPortion(e, mySplitByTx)
    if (amount === null) continue // shared with no own split → not ours
    aggRows.push({
      categoryId: e.subcategory_id ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount,
    })
  }
  for (const r of reimbRows) {
    const amount = categoryOwnPortion(r, mySplitByTx)
    if (amount === null) continue
    const linked = r.linked_transaction_id ? linkedSubcategoryById.get(r.linked_transaction_id) : null
    if (!linked || linked.categoryId !== categoryId) continue
    aggRows.push({
      categoryId: linked.subcategoryId ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount,
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
