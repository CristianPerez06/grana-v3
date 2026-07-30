import type { GranaSupabaseClient } from '@grana/supabase'
import type {
  PendingReimbursementVM,
  TransactionCategory,
  TransactionWithDetails,
} from './types'
import { toFinancialMovement, type FinancialMovement } from './movements'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  resolveMonthRange,
  type MovementFilters,
} from './filters'

// The select shape shared by every per-row detail read (movements list, detail,
// installment family). The global movements feed uses the get_movements_page RPC
// instead, so it does not go through this constant.
export const TRANSACTION_SELECT = `
  *,
  category:categories(id, name, canonical_name, color, icon, user_id),
  subcategory:subcategories(id, name, canonical_name, category_id, user_id),
  destination_account:accounts!transactions_transfer_destination_account_id_fkey(id, name, type, institution:institutions(name)),
  source_account:accounts!transactions_account_id_fkey(id, name, type, institution:institutions(name)),
  period_payments!period_payments_transaction_id_fkey(
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
//
// The `.in('id', …)` below has no explicit bound, but its product is DISPLAY
// metadata (the origin expense's category), not a money number, so the
// "complete by construction" requirement of `web-data-access` does not reach it:
// a truncated result degrades a label, it never corrupts a balance.
export async function attachLinkedExpenses(
  supabase: GranaSupabaseClient,
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
export const isHistoryRow = (r: TransactionWithDetails): boolean =>
  r.type !== 'reimbursement' || (r.received_at != null && r.cancelled_at == null)

// ── getAccountMovementsAscending ──────────────────────────────────────────────
// Every movement affecting an account, in calculation order (date/created_at/id
// ASC). No user-facing filtering: the running balance needs the full history to
// be correct, and /accounts/[id] applies the filters + slice client-side over
// this dataset (the visible page and the balance share the same underlying data
// — TanStack caches one fetch, not two). The caller composes this with
// `computeRunningBalances` from `@grana/money-logic`.
//
// It IS paginated, exhaustively: the read walks `.range()` until the set is
// exhausted. Its product is a balance, so it must be complete BY CONSTRUCTION
// (spec `web-data-access`) — a plain `.select()` is silently capped by
// PostgREST's server-side `max-rows`, and an account whose history crosses that
// ceiling would render a running balance missing its oldest movements with no
// error to show for it.

/** Rows per round-trip. Independent of the server's `max-rows`: the loop
 *  advances by what actually came back and stops on an empty page, so a smaller
 *  server cap costs extra round-trips but never truncates. */
const ACCOUNT_MOVEMENTS_PAGE_SIZE = 1000

export async function getAccountMovementsAscending(
  supabase: GranaSupabaseClient,
  accountId: string,
): Promise<TransactionWithDetails[]> {
  const rows: TransactionWithDetails[] = []

  for (let offset = 0; ; ) {
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .or(`account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`)
      // Deterministic order is what makes the paging stable — without it the
      // pages could overlap or skip rows.
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + ACCOUNT_MOVEMENTS_PAGE_SIZE - 1)

    if (error) throw error

    const batch = (data ?? []) as unknown as TransactionWithDetails[]
    if (batch.length === 0) break

    rows.push(...batch)
    offset += batch.length
  }

  return attachLinkedExpenses(supabase, rows.filter(isHistoryRow))
}

// ── getPendingReimbursements ───────────────────────────────────────────────────
// Pending reimbursements (expected, not yet received nor cancelled), surfaced in
// the "A confirmar" block. Optionally scoped to one account (its account detail).

export async function getPendingReimbursements(
  supabase: GranaSupabaseClient,
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

// ── Global movements feed ─────────────────────────────────────────────────────
// The `/transactions` feed (web) and the mobile Movimientos tab. The whole page
// — filters, the isHistoryRow rule, the linked-expense self-join and the limit+1
// lookahead — is resolved by the `get_movements_page` RPC in ONE round-trip
// (migration 0029). These functions only translate the `MovementFilters`
// contract to the RPC's jsonb input and map rows to `FinancialMovement`.

export async function getGlobalMovements(
  supabase: GranaSupabaseClient,
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<FinancialMovement[]> {
  const page = await getGlobalMovementsPage(supabase, options)
  return page.movements
}

export async function getGlobalMovementsPage(
  supabase: GranaSupabaseClient,
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
      excludeShared: filters.excludeShared ? true : undefined,
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

// Lightweight check used by the empty-state copy in the movements feed. Decides
// between the welcome variant (first-time user) and the month-vacío variant
// (user has history elsewhere, just navigated to an empty month). LIMIT 1 so
// the cost is constant regardless of dataset size.

export async function hasAnyTransaction(supabase: GranaSupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.from('transactions').select('id').limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// ── Transaction-graph detail reads ────────────────────────────────────────────
// The reads that feed a movement's own detail graph: the transaction itself (+
// linked expense), its installment family, and its reimbursements. Isomorphic
// (`GranaSupabaseClient`) so both the web detail page and the mobile
// `/transactions/[txId]` screen consume them from here — one implementation, same
// select shape (`TRANSACTION_SELECT`) and linked-expense enrich as the feed.

export async function getTransactionDetail(
  supabase: GranaSupabaseClient,
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

// Returns parent + all child rows for a given parent_id (or null if not found).

export async function getInstallmentFamily(
  supabase: GranaSupabaseClient,
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
  supabase: GranaSupabaseClient,
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
