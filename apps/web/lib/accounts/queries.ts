import type { DbClient } from '@/lib/supabase/db-client'
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

// Returns the set of account IDs that have at least one transaction referencing
// them (either as origin or as transfer destination), excluding off-ledger
// parent rows. Single round-trip; the row's "archive vs delete" affordance reads
// from this set per account.
async function getAccountIdsWithTransactions(
  supabase: DbClient,
  accountIds: string[],
): Promise<Set<string>> {
  if (accountIds.length === 0) return new Set()

  const idList = accountIds.join(',')
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id')
    .or(
      `account_id.in.(${idList}),transfer_destination_account_id.in.(${idList})`,
    )
    .or('is_parent.is.null,is_parent.eq.false')

  if (error) throw error

  const ids = new Set(accountIds)
  const hits = new Set<string>()
  for (const row of (data ?? []) as Array<{
    account_id: string | null
    transfer_destination_account_id: string | null
  }>) {
    if (row.account_id && ids.has(row.account_id)) hits.add(row.account_id)
    if (
      row.transfer_destination_account_id &&
      ids.has(row.transfer_destination_account_id)
    ) {
      hits.add(row.transfer_destination_account_id)
    }
  }
  return hits
}

// ── getAccounts ───────────────────────────────────────────────────────────────

export async function getAccounts(
  supabase: DbClient,
  options: { includeArchived?: boolean } = {},
): Promise<GroupedAccountsWithBalances> {
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
    getCreditCards(supabase, options),
  ])

  if (error) throw error

  const accounts = (data ?? []) as AccountWithDetails[]
  const accountIds = accounts.map((a) => a.id)
  const [txSumsMap, accountsWithTx] = await Promise.all([
    getTransactionSums(supabase, accountIds),
    getAccountIdsWithTransactions(supabase, accountIds),
  ])

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
    has_transactions: accountsWithTx.has(a.id),
  }))

  return {
    cash: withBalances.filter((a) => a.type === 'cash'),
    bank: withBalances.filter((a) => a.type === 'bank'),
    credit: creditCards,
  }
}

// ── getCashAndBankAccounts ────────────────────────────────────────────────────

type GroupedCashAndBank = {
  cash: AccountWithBalances[]
  bank: AccountWithBalances[]
}

export async function getCashAndBankAccounts(
  supabase: DbClient,
  options: { archivedOnly?: boolean } = {},
): Promise<GroupedCashAndBank> {

  let query = supabase
    .from('accounts')
    .select(`
      *,
      institution:institutions(*),
      currencies:account_currencies(*)
    `)
    .in('type', ['cash', 'bank'])
    .order('created_at', { ascending: true })

  query = options.archivedOnly ? query.eq('is_active', false) : query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error

  const accounts = (data ?? []) as AccountWithDetails[]
  const accountIds = accounts.map((a) => a.id)
  const [txSumsMap, accountsWithTx] = await Promise.all([
    getTransactionSums(supabase, accountIds),
    getAccountIdsWithTransactions(supabase, accountIds),
  ])

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
    has_transactions: accountsWithTx.has(a.id),
  }))

  return {
    cash: withBalances.filter((a) => a.type === 'cash'),
    bank: withBalances.filter((a) => a.type === 'bank'),
  }
}

// ── getAccountDetail ──────────────────────────────────────────────────────────

export async function getAccountDetail(
  supabase: DbClient,
  id: string,
): Promise<AccountWithBalances | null> {

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
  const [txSumsMap, accountsWithTx] = await Promise.all([
    getTransactionSums(supabase, [id]),
    getAccountIdsWithTransactions(supabase, [id]),
  ])
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

  return {
    ...account,
    balances,
    avatar: resolveAccountAvatar(account, account.institution),
    has_transactions: accountsWithTx.has(id),
  }
}

// ── getInstitutions ───────────────────────────────────────────────────────────

export async function getInstitutions(supabase: DbClient) {

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

