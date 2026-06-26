import { useQuery } from '@tanstack/react-query'
import {
  getCashAndBankAccounts,
  getAccountDetail,
  getInstitutions,
} from '@grana/accounts'
import {
  getAccountMovementsAscending,
  getPendingReimbursements,
} from '@grana/transactions'
import { supabase } from '../supabase'
import { accountKeys } from './query-keys'

// TanStack reads over the shared packages — mirror of lib/dashboard/queries.ts.
// `getCashAndBankAccounts`/`getAccountDetail` don't need `today` (only the
// mutations do); the reads derive balances from initial_balance + tx sums.

export function useAccountsList() {
  return useQuery({
    queryKey: accountKeys.list,
    queryFn: () => getCashAndBankAccounts(supabase),
  })
}

export function useArchivedAccounts() {
  return useQuery({
    queryKey: accountKeys.archived,
    queryFn: () => getCashAndBankAccounts(supabase, { archivedOnly: true }),
  })
}

export function useAccountDetail(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => getAccountDetail(supabase, id),
    enabled: Boolean(id),
  })
}

export function useInstitutions() {
  return useQuery({
    queryKey: accountKeys.institutions,
    queryFn: () => getInstitutions(supabase),
  })
}

export function useAccountMovements(id: string) {
  return useQuery({
    queryKey: accountKeys.movements(id),
    queryFn: () => getAccountMovementsAscending(supabase, id),
    enabled: Boolean(id),
  })
}

export function usePendingReimbursements(id: string) {
  return useQuery({
    queryKey: accountKeys.pendingReimbursements(id),
    queryFn: () => getPendingReimbursements(supabase, id),
    enabled: Boolean(id),
  })
}
