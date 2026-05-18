import { createClient } from '@/lib/supabase/server'
import type {
  AccountWithDetails,
  GroupedAccounts,
} from './types'

// ── getAccounts ───────────────────────────────────────────────────────────────

export async function getAccounts(
  options: { includeArchived?: boolean } = {},
): Promise<GroupedAccounts> {
  const supabase = await createClient()

  let query = supabase
    .from('accounts')
    .select(`
      *,
      institution:institutions(*),
      currencies:account_currencies(*)
    `)
    .order('created_at', { ascending: true })

  if (!options.includeArchived) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) throw error

  const accounts = (data ?? []) as AccountWithDetails[]

  return {
    cash: accounts.filter((a) => a.type === 'cash'),
    bank: accounts.filter((a) => a.type === 'bank'),
  }
}

// ── getAccountDetail ──────────────────────────────────────────────────────────

export async function getAccountDetail(id: string): Promise<AccountWithDetails | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounts')
    .select(`
      *,
      institution:institutions(*),
      currencies:account_currencies(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as AccountWithDetails | null
}

// ── getInstitutions ───────────────────────────────────────────────────────────

export async function getInstitutions() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

