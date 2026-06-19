import { useQuery } from '@tanstack/react-query'
import {
  getCommittedOutlook,
  getDashboardHero,
  getMonthBalanceSeries,
  getMonthCategoryBreakdown,
} from '@grana/dashboard'
import { supabase } from '../supabase'

const monthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`

export function useDashboardHero() {
  return useQuery({
    queryKey: ['dashboard', 'hero'] as const,
    queryFn: () => getDashboardHero(supabase),
  })
}

export function useMonthBalanceSeries(year: number, month: number) {
  return useQuery({
    queryKey: ['dashboard', 'balance-series', { year, month }] as const,
    queryFn: () => getMonthBalanceSeries(supabase, year, month),
  })
}

// "Comprometido" — static "from today" (does NOT follow the month navigator).
export function useCommittedOutlook() {
  return useQuery({
    queryKey: ['dashboard', 'committed'] as const,
    queryFn: () => getCommittedOutlook(supabase),
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

export function useMonthCategoryBreakdown(year: number, month: number) {
  const key = monthKey(year, month)
  return useQuery({
    queryKey: ['dashboard', 'category-breakdown', key] as const,
    queryFn: () => getMonthCategoryBreakdown(supabase, key),
  })
}
