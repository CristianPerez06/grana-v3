import { useQuery } from '@tanstack/react-query'
import {
  getCommittedOutlookForMonth,
  getDashboardHero,
  getMonthBalanceSeries,
  getMonthCategoryBreakdown,
  getMonthIncomeBreakdown,
  getMonthSpending,
  getMonthSubcategoryBreakdown,
  hasUsdAccount,
} from '@grana/dashboard'
import { supabase } from '../supabase'

const monthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`

/**
 * Available balance AS OF a cut date. The dashboard passes the last day of the
 * month being viewed (today for the current one), so the balance moves with the
 * rest of the card instead of leaving today's number over another month's flows.
 */
export function useDashboardHero(asOfISO: string) {
  return useQuery({
    queryKey: ['dashboard', 'hero', asOfISO] as const,
    queryFn: () => getDashboardHero(supabase, asOfISO),
  })
}

export function useMonthBalanceSeries(year: number, month: number) {
  return useQuery({
    queryKey: ['dashboard', 'balance-series', { year, month }] as const,
    queryFn: () => getMonthBalanceSeries(supabase, year, month),
  })
}

/**
 * "Comprometido" for the SELECTED month. The window is the month AFTER it, and
 * each commitment's state is evaluated at that month's close (today for the
 * current one). Both travel on the result so the card labels itself from the
 * data instead of from a clock of its own.
 */
export function useCommittedOutlook({ year, month }: { year: number; month: number }) {
  return useQuery({
    queryKey: ['dashboard', 'committed', year, month] as const,
    queryFn: () => getCommittedOutlookForMonth(supabase, { year, month }),
  })
}

export function useProfileFirstName() {
  return useQuery({
    queryKey: ['dashboard', 'profile-first-name'] as const,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return ''
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      const fullName = (data?.full_name as string | undefined) ?? ''
      return fullName.split(' ')[0] ?? ''
    },
  })
}

// Expense by category — the donut's data in Egresos mode. Keyed under
// `transactions` (not `dashboard`) to mirror web's `QUERY_KEYS.breakdownExpense`:
// the dashboard consumes this read to build "Gastaste", but the breakdown the
// key addresses belongs to the Movimientos surface. Safe to realign — the hook
// had no consumer and nothing invalidated the old key.
export function useMonthCategoryBreakdown(year: number, month: number, enabled = true) {
  const key = monthKey(year, month)
  return useQuery({
    queryKey: ['transactions', 'breakdown', 'expense', key] as const,
    queryFn: () => getMonthCategoryBreakdown(supabase, key),
    enabled,
  })
}

// "Cuánto gastaste" — own spending of the month split by settlement state.
export function useMonthSpending(year: number, month: number) {
  const key = monthKey(year, month)
  return useQuery({
    queryKey: ['dashboard', 'month-spending', key] as const,
    queryFn: () => getMonthSpending(supabase, key),
  })
}

// ── "En qué se fue" — the spending overview's reads ───────────────────────────
// Query keys mirror web's `QUERY_KEYS.breakdown*` / `hasUsdAccount` shapes, so
// the same breakdown is addressable the same way on both platforms and an
// invalidation written for one reads correctly against the other.

/** Income by category ("De dónde vino") — the Ingresos mode of the overview. */
export function useMonthIncomeBreakdown(year: number, month: number, enabled = true) {
  const key = monthKey(year, month)
  return useQuery({
    queryKey: ['transactions', 'breakdown', 'income', key] as const,
    queryFn: () => getMonthIncomeBreakdown(supabase, key),
    enabled,
  })
}

/**
 * Subcategory composition of ONE category — the in-category donut the overview
 * shows while a category filter is active. Gated on `categoryId`: with no
 * category there is nothing to decompose.
 */
export function useMonthSubcategoryBreakdown(
  year: number,
  month: number,
  categoryId: string | null,
) {
  const key = monthKey(year, month)
  return useQuery({
    queryKey: ['transactions', 'breakdown', 'expense', key, 'subcategory', categoryId ?? ''] as const,
    queryFn: () => getMonthSubcategoryBreakdown(supabase, key, categoryId as string),
    enabled: Boolean(categoryId),
  })
}

/**
 * Whether the user operates in USD at all (bimoneda) — gates the ARS/USD pills.
 *
 * The question is "does this user think in two currencies", NOT "did this month
 * have USD movements": gating by month would make the toggle vanish when the
 * user navigates to a month with no USD activity, stranding them in ARS. Being
 * month-independent, it also caches across navigation.
 */
export function useHasUsdAccount() {
  return useQuery({
    queryKey: ['transactions', 'breakdown', 'has-usd-account'] as const,
    queryFn: () => hasUsdAccount(supabase),
    staleTime: 30 * 60 * 1000,
  })
}
