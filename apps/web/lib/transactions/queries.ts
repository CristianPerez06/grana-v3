import { createClient } from '@/lib/supabase/server'
import type { TransactionWithDetails } from './types'

const TRANSACTION_SELECT = `
  *,
  category:categories(id, name, canonical_name, color, icon),
  subcategory:subcategories(id, name, canonical_name, category_id)
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
    .eq('account_id', accountId)
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
