import type { GranaSupabaseClient } from '@grana/supabase'
import {
  balanceSumsFromRows,
  formatDateISO,
  getTodayAR,
  type BalanceCurrency,
} from '@grana/money-logic'
import { getCreditCards, type CreditCardSummary } from '@grana/cards'
import { Money } from '@grana/validation'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { AccountWithDetails, AccountWithBalances } from './types'

type GroupedAccountsWithBalances = {
  cash: AccountWithBalances[]
  bank: AccountWithBalances[]
  credit: CreditCardSummary[]
}

type GroupedCashAndBank = {
  cash: AccountWithBalances[]
  bank: AccountWithBalances[]
}

function addMoneyAmounts(a: number | string, b: number | string): number {
  return Money.toNumber(Money.add(Money.from(a), Money.from(b)))
}

// ── getTransactionSums ────────────────────────────────────────────────────────
// Net per account and currency, aggregated in Postgres by the
// `get_account_balance_sums` RPC (migration 0051).
//
// It used to `.select()` the whole ledger and sum it in JS. That read had no
// `.range()`, no `.limit()` and no `.order()`, so PostgREST's server-side
// `max-rows` truncated it in SILENCE past the ceiling: no error, fewer rows, an
// arbitrary subset — and a plausible-but-wrong balance. Aggregating in SQL makes
// the response size a function of the number of ACCOUNTS instead of the number
// of MOVEMENTS, so the ceiling stops being reachable (spec `web-data-access`).
//
// `calculateTransactionSums` stays the source of truth for the per-type sign
// rules; the RPC replicates them and a parity test anchors the equivalence
// (apps/web/lib/accounts/__tests__/balance-sums-migration.test.ts).
//
// `p_today` pins the temporal cut (migration 0052) to the same financial "hoy"
// the rest of the UI renders: future-dated rows stay out of the balance.
export async function getTransactionSums(
  supabase: GranaSupabaseClient,
  accountIds: string[],
): Promise<Map<string, Record<BalanceCurrency, number>>> {
  if (accountIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc('get_account_balance_sums', {
    p_account_ids: accountIds,
    p_today: formatDateISO(getTodayAR()),
  })

  if (error) throw error

  return balanceSumsFromRows(data ?? [])
}

// Returns the set of account IDs that have at least one transaction referencing
// them (either as origin or as transfer destination), excluding off-ledger
// parent rows. The row's "archive vs delete" affordance reads from this set.
//
// One EXISTS probe per account (`.limit(1)`) instead of pulling the whole ledger
// and reducing it client-side. The old shape was the same uncapped `.select()`
// the balance reads had: past PostgREST's `max-rows` it truncated in silence,
// and an account whose movements fell outside the truncated window would look
// empty — offering DELETE on an account that has history. The probe is bounded
// by construction: it can never return more than one row.
async function getAccountIdsWithTransactions(
  supabase: GranaSupabaseClient,
  accountIds: string[],
): Promise<Set<string>> {
  if (accountIds.length === 0) return new Set()

  const probes = await Promise.all(
    accountIds.map(async (id) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .or(`account_id.eq.${id},transfer_destination_account_id.eq.${id}`)
        .or('is_parent.is.null,is_parent.eq.false')
        .limit(1)

      if (error) throw error
      return [id, (data ?? []).length > 0] as const
    }),
  )

  return new Set(probes.filter(([, hasAny]) => hasAny).map(([id]) => id))
}

// ── getAccounts ───────────────────────────────────────────────────────────────

export async function getAccounts(
  supabase: GranaSupabaseClient,
  options: { today: Date; includeArchived?: boolean },
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

export async function getCashAndBankAccounts(
  supabase: GranaSupabaseClient,
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
  supabase: GranaSupabaseClient,
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

export async function getInstitutions(supabase: GranaSupabaseClient) {

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
