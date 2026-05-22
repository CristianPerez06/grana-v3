import { useQuery } from '@tanstack/react-query'
import {
  getDashboardHero,
  getMonthBalanceSeries,
  getUpcomingFortnight,
  hasUserMovements,
} from '@grana/dashboard'
import { supabase } from '../supabase'
import { getCreditCards } from '../cards/queries'

const ymdKey = (date: Date) => date.toISOString().slice(0, 10)

export function useDashboardHero() {
  return useQuery({
    queryKey: ['dashboard', 'hero'] as const,
    queryFn: () => getDashboardHero(supabase),
  })
}

export function useUpcomingFortnight(today: Date) {
  return useQuery({
    queryKey: ['dashboard', 'upcoming-fortnight', ymdKey(today)] as const,
    queryFn: () => getUpcomingFortnight(supabase, today),
  })
}

export function useMonthBalanceSeries(year: number, month: number) {
  return useQuery({
    queryKey: ['dashboard', 'balance-series', { year, month }] as const,
    queryFn: () => getMonthBalanceSeries(supabase, year, month),
  })
}

export function useDashboardCards() {
  return useQuery({
    queryKey: ['dashboard', 'cards'] as const,
    queryFn: () => getCreditCards(),
  })
}

export function useHasMovements() {
  return useQuery({
    queryKey: ['dashboard', 'has-movements'] as const,
    queryFn: () => hasUserMovements(supabase),
  })
}
