import { createClient } from '@/lib/supabase/server'
import { computeCategoryNet, type CategoryAggRow, type CategorySliceInput } from '@grana/money-logic'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  movementMatchesText,
  resolveMonthRange,
  type MovementFilters,
} from './filters'
import { toFinancialMovement, type FinancialMovement } from './movements'
import type { TransactionCategory, TransactionWithDetails } from './types'

const TRANSACTION_SELECT = `
  *,
  category:categories(id, name, canonical_name, color, icon),
  subcategory:subcategories(id, name, canonical_name, category_id),
  destination_account:accounts!transactions_transfer_destination_account_id_fkey(id, name, type),
  source_account:accounts!transactions_account_id_fkey(id, name, type),
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

const GLOBAL_MOVEMENTS_QUERY_CHUNK_SIZE = 200

// Reimbursements derive their category from the linked expense. PostgREST can't
// reliably embed a self-referential FK (transactions → transactions), so we
// stitch it in a second query (same approach grana-v2 used for cashback).
async function attachLinkedExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
    .select('id, description, amount, currency_code, date, category:categories(id, name, canonical_name, color, icon)')
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
  accountId: string,
  options: { limit?: number; offset?: number; currencyCode?: 'ARS' | 'USD' } = {},
): Promise<TransactionWithDetails[]> {
  const supabase = await createClient()
  const { limit = 20, offset = 0, currencyCode } = options

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .or(`account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
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

// ── getAccountMovements ───────────────────────────────────────────────────────
// All movements affecting an account, in calculation order (date/created_at/id
// ASC). No pagination: the running balance needs the full history to be correct.
// The caller reverses to display order and computes running balances.

export async function getAccountMovements(
  accountId: string,
): Promise<TransactionWithDetails[]> {
  const supabase = await createClient()

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
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<FinancialMovement[]> {
  const page = await getGlobalMovementsPage(options)
  return page.movements
}

export async function getGlobalMovementsPage(
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<{
  movements: FinancialMovement[]
  hasMore: boolean
  nextLimit: number
}> {
  const supabase = await createClient()
  const { limit = DEFAULT_MOVEMENTS_LIMIT, offset = 0, filters = {} } = options

  let parentIdsForAccount: string[] = []
  let cardPaymentIdsForAccount: string[] = []
  if (filters.accountId) {
    const [childRowsResult, cardPaymentsResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('parent_id')
        .eq('account_id', filters.accountId)
        .not('parent_id', 'is', null),
      supabase
        .from('period_payments')
        .select('transaction_id, card_periods!inner(account_id)')
        .eq('card_periods.account_id', filters.accountId),
    ])

    if (childRowsResult.error) throw childRowsResult.error
    if (cardPaymentsResult.error) throw cardPaymentsResult.error

    parentIdsForAccount = [
      ...new Set(
        (childRowsResult.data ?? [])
          .map((row) => row.parent_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    cardPaymentIdsForAccount = [
      ...new Set((cardPaymentsResult.data ?? []).map((row) => row.transaction_id)),
    ]
  }

  const matchingMovements: FinancialMovement[] = []
  let queryOffset = offset

  while (matchingMovements.length <= limit) {
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .is('parent_id', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(queryOffset, queryOffset + GLOBAL_MOVEMENTS_QUERY_CHUNK_SIZE - 1)

    if (filters.from) query = query.gte('date', filters.from)
    if (filters.to) query = query.lte('date', filters.to)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.currency) query = query.eq('currency_code', filters.currency)

    if (filters.accountId) {
      const accountConditions = [
        `account_id.eq.${filters.accountId}`,
        `transfer_destination_account_id.eq.${filters.accountId}`,
      ]

      if (parentIdsForAccount.length > 0) {
        accountConditions.push(`id.in.(${parentIdsForAccount.join(',')})`)
      }

      if (cardPaymentIdsForAccount.length > 0) {
        accountConditions.push(`id.in.(${cardPaymentIdsForAccount.join(',')})`)
      }

      query = query.or(accountConditions.join(','))
    }

    const { data, error } = await query

    if (error) throw error

    const historyRows = ((data ?? []) as unknown as TransactionWithDetails[]).filter(isHistoryRow)
    const enrichedRows = await attachLinkedExpenses(supabase, historyRows)
    const pageMovements = enrichedRows
      .map(toFinancialMovement)
      .filter((movement) => !filters.type || movement.kind === filters.type)
      .filter((movement) => !filters.query || movementMatchesText(movement, filters.query))
      .filter((movement) => filters.amountMin == null || movement.amount >= filters.amountMin)
      .filter((movement) => filters.amountMax == null || movement.amount <= filters.amountMax)

    matchingMovements.push(...pageMovements)

    if ((data ?? []).length < GLOBAL_MOVEMENTS_QUERY_CHUNK_SIZE) break
    queryOffset += GLOBAL_MOVEMENTS_QUERY_CHUNK_SIZE
  }

  const hasMore = matchingMovements.length > limit && limit < MAX_MOVEMENTS_LIMIT

  return {
    movements: matchingMovements.slice(0, limit),
    hasMore,
    nextLimit: Math.min(limit + MOVEMENTS_LIMIT_STEP, MAX_MOVEMENTS_LIMIT),
  }
}

export async function getMovementFilterOptions(): Promise<{
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' | 'both' }>
}> {
  const supabase = await createClient()

  const [accountsResult, categoriesResult] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true)
      .order('type')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, type')
      .eq('is_active', true)
      .order('type')
      .order('name'),
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
    }>,
  }
}

export async function getTransactionDetail(
  id: string,
): Promise<TransactionWithDetails | null> {
  const supabase = await createClient()

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

export async function getInstallmentFamily(parentId: string): Promise<{
  parent: TransactionWithDetails | null
  children: TransactionWithDetails[]
}> {
  const supabase = await createClient()

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
  categoryIcon: string | null
  categoryColor: string | null
  expenseDescription: string | null
  /** Date of the linked consumption — the default date when confirming. */
  expenseDate: string | null
}

export async function getPendingReimbursements(
  accountId?: string,
): Promise<PendingReimbursementVM[]> {
  const supabase = await createClient()

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
      .select('id, description, date, category:categories(id, name, canonical_name, color, icon)')
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
  expenseId: string,
): Promise<ExpenseReimbursementVM[]> {
  const supabase = await createClient()

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

// ── getAllReimbursements ───────────────────────────────────────────────────────
// Global list of reimbursements across EVERY state, optionally filtered. The
// chronological movement list only shows received ones, so this is the single
// place to see pending and cancelled reimbursements together.

export type ReimbursementState = 'pending' | 'received' | 'cancelled'

export type ReimbursementListItem = {
  id: string
  amount: number
  currencyCode: 'ARS' | 'USD'
  target: 'account' | 'statement'
  state: ReimbursementState
  date: string
  accountName: string | null
  categoryName: string | null
  categoryIcon: string | null
  categoryColor: string | null
  expenseDescription: string | null
}

export async function getAllReimbursements(
  state?: ReimbursementState,
): Promise<ReimbursementListItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(
      'id, amount, currency_code, reimbursement_target, received_at, cancelled_at, date, linked_transaction_id, source_account:accounts!transactions_account_id_fkey(name)',
    )
    .eq('type', 'reimbursement')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (state === 'pending') query = query.is('received_at', null).is('cancelled_at', null)
  else if (state === 'received') query = query.not('received_at', 'is', null)
  else if (state === 'cancelled') query = query.not('cancelled_at', 'is', null)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    id: string
    amount: number
    currency_code: 'ARS' | 'USD'
    reimbursement_target: 'account' | 'statement'
    received_at: string | null
    cancelled_at: string | null
    date: string
    linked_transaction_id: string | null
    source_account: { name: string } | null
  }>

  const linkedIds = [
    ...new Set(rows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id))),
  ]
  const linkedMap = new Map<
    string,
    { description: string | null; category: TransactionCategory | null }
  >()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, description, category:categories(id, name, canonical_name, color, icon)')
      .in('id', linkedIds)
    for (const e of (linked ?? []) as unknown as Array<{
      id: string
      description: string | null
      category: TransactionCategory | null
    }>) {
      linkedMap.set(e.id, { description: e.description, category: e.category })
    }
  }

  return rows.map((r) => {
    const linked = r.linked_transaction_id ? linkedMap.get(r.linked_transaction_id) : undefined
    return {
      id: r.id,
      amount: r.amount,
      currencyCode: r.currency_code,
      target: r.reimbursement_target,
      state: r.cancelled_at ? 'cancelled' : r.received_at ? 'received' : 'pending',
      date: r.date,
      accountName: r.source_account?.name ?? null,
      categoryName: linked?.category?.name ?? null,
      categoryIcon: linked?.category?.icon ?? null,
      categoryColor: linked?.category?.color ?? null,
      expenseDescription: linked?.description ?? null,
    }
  })
}

// ── getMonthCategoryBreakdown ──────────────────────────────────────────────────
// Spending by category for a month: expenses (cash/debit + card consumos + the
// installment cuota that accrues in the month) minus received reimbursements,
// net per category and currency. Excludes installment parents (off-ledger) and
// statement payments (the spend already counted as the consumos). Uncategorized
// spend is bucketed under the `uncategorized` sentinel (the UI labels it).

export const UNCATEGORIZED_ID = 'uncategorized'

export type MonthCategoryBreakdown = {
  ARS: CategorySliceInput[]
  USD: CategorySliceInput[]
}

export async function getMonthCategoryBreakdown(month: string): Promise<MonthCategoryBreakdown> {
  const supabase = await createClient()
  const { from, to } = resolveMonthRange(month)

  const [expensesResult, reimbursementsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('category_id, currency_code, amount, is_parent, period_payments(id)')
      .eq('type', 'expense')
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
  ])
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error

  const expenseRows = (expensesResult.data ?? []) as unknown as Array<{
    category_id: string | null
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

  // Derived category for the received reimbursements (from the linked expense).
  const linkedIds = [
    ...new Set(reimbRows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id))),
  ]
  const linkedCategoryById = new Map<string, string | null>()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, category_id')
      .in('id', linkedIds)
    for (const e of linked ?? []) linkedCategoryById.set(e.id, e.category_id)
  }

  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (e.is_parent) continue // installment parent is off-ledger; its cuotas count
    if ((e.period_payments?.length ?? 0) > 0) continue // statement payment, not category spend
    aggRows.push({
      categoryId: e.category_id ?? UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount: e.amount,
    })
  }
  for (const r of reimbRows) {
    const derived = r.linked_transaction_id ? linkedCategoryById.get(r.linked_transaction_id) : null
    aggRows.push({
      categoryId: derived ?? UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount: r.amount,
      received_at: r.received_at,
      cancelled_at: r.cancelled_at,
    })
  }

  const netByCategory = computeCategoryNet(aggRows)

  const realIds = [...netByCategory.keys()].filter((id) => id !== UNCATEGORIZED_ID)
  const categoryById = new Map<string, { name: string; color: string | null; icon: string | null }>()
  if (realIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color, icon')
      .in('id', realIds)
    for (const c of cats ?? []) {
      categoryById.set(c.id, { name: c.name, color: c.color, icon: c.icon })
    }
  }

  const build = (currency: 'ARS' | 'USD'): CategorySliceInput[] => {
    const out: CategorySliceInput[] = []
    for (const [id, perCurrency] of netByCategory.entries()) {
      const value = perCurrency[currency].neto
      if (value <= 0) continue
      const display = id === UNCATEGORIZED_ID ? null : categoryById.get(id)
      // Uncategorized label is left empty; the UI fills it (i18n).
      out.push({
        categoryId: id,
        label: display?.name ?? '',
        color: display?.color ?? null,
        icon: display?.icon ?? null,
        value,
      })
    }
    return out
  }

  return { ARS: build('ARS'), USD: build('USD') }
}
