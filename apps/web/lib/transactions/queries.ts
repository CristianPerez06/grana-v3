import { createClient } from '@/lib/supabase/server'
import { toFinancialMovement, type FinancialMovement } from './movements'
import type { TransactionWithDetails } from './types'

const TRANSACTION_SELECT = `
  *,
  category:categories(id, name, canonical_name, color, icon),
  subcategory:subcategories(id, name, canonical_name, category_id),
  destination_account:accounts!transactions_transfer_destination_account_id_fkey(id, name, type),
  source_account:accounts!transactions_account_id_fkey(id, name, type),
  period_payments(id, period_id)
`

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
  options: { limit?: number; offset?: number } = {},
): Promise<FinancialMovement[]> {
  const supabase = await createClient()
  const { limit = 50, offset = 0 } = options

  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .is('parent_id', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return ((data ?? []) as TransactionWithDetails[]).map(toFinancialMovement)
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
