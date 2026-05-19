import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MAX_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  movementMatchesText,
  type MovementFilters,
} from './filters'
import { toFinancialMovement, type FinancialMovement } from './movements'
import type { TransactionWithDetails } from './types'

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

  return (data ?? []) as TransactionWithDetails[]
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

    const pageMovements = ((data ?? []) as TransactionWithDetails[])
      .map(toFinancialMovement)
      .filter((movement) => !filters.type || movement.kind === filters.type)
      .filter((movement) => !filters.query || movementMatchesText(movement, filters.query))

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

  return data as TransactionWithDetails | null
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
    parent: parentResult.error ? null : (parentResult.data as TransactionWithDetails),
    children: (childrenResult.data ?? []) as TransactionWithDetails[],
  }
}
