import { createClient } from '@/lib/supabase/server'
import { getTransactionSums } from '@/lib/transactions/balance'
import { getCreditCards, type CreditCardSummary } from '@/lib/cards/queries'
import { Money } from '@grana/validation'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type {
  AccountWithDetails,
  AccountWithBalances,
} from './types'

type GroupedAccountsWithBalances = {
  cash: AccountWithBalances[]
  bank: AccountWithBalances[]
  credit: CreditCardSummary[]
}

function addMoneyAmounts(a: number | string, b: number | string): number {
  return Money.toNumber(Money.add(Money.from(a), Money.from(b)))
}

// ── getAccounts ───────────────────────────────────────────────────────────────

export async function getAccounts(
  options: { includeArchived?: boolean } = {},
): Promise<GroupedAccountsWithBalances> {
  const supabase = await createClient()

  let query = supabase
    .from('accounts')
    .select(`
      *,
      institution:institutions(*),
      currencies:account_currencies(*)
    `)
    .in('type', ['cash', 'bank'])
    .order('created_at', { ascending: true })

  if (!options.includeArchived) {
    query = query.eq('is_active', true)
  }

  const [{ data, error }, creditCards] = await Promise.all([
    query,
    getCreditCards(options),
  ])

  if (error) throw error

  const accounts = (data ?? []) as AccountWithDetails[]
  const accountIds = accounts.map((a) => a.id)
  const txSumsMap = await getTransactionSums(accountIds)

  const withBalances = accounts.map((a) => ({
    ...a,
    balances: {
      ARS: a.currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0,
      USD: a.currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0,
      ...Object.fromEntries(
        Object.entries(txSumsMap.get(a.id) ?? {}).map(([k, v]) => [
          k,
          addMoneyAmounts(a.currencies.find((c) => c.currency_code === k)?.initial_balance ?? 0, v),
        ]),
      ),
    } as Record<'ARS' | 'USD', number>,
    avatar: resolveAccountAvatar(a, a.institution),
  }))

  return {
    cash: withBalances.filter((a) => a.type === 'cash'),
    bank: withBalances.filter((a) => a.type === 'bank'),
    credit: creditCards,
  }
}

// ── getAccountDetail ──────────────────────────────────────────────────────────

export async function getAccountDetail(id: string): Promise<AccountWithBalances | null> {
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

  const account = data as AccountWithDetails
  const txSumsMap = await getTransactionSums([id])
  const txSums = txSumsMap.get(id) ?? { ARS: 0, USD: 0 }

  const balances: Record<'ARS' | 'USD', number> = { ARS: 0, USD: 0 }
  for (const c of account.currencies) {
    if (c.currency_code === 'ARS' || c.currency_code === 'USD') {
      balances[c.currency_code] = addMoneyAmounts(
        c.initial_balance,
        txSums[c.currency_code] ?? 0,
      )
    }
  }

  return { ...account, balances, avatar: resolveAccountAvatar(account, account.institution) }
}

// ── getInstitutions ───────────────────────────────────────────────────────────

export async function getInstitutions() {
  const supabase = await createClient()

  // RLS already filters: each user sees the catalog (user_id NULL) plus their
  // own custom rows. We order catalog first, custom last (each block alphabetic).
  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('is_active', true)
    .order('user_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

