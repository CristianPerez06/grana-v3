import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getAvailableSums,
  getReserveHistory,
  type AvailableSums,
  type ReserveEntry,
} from '@grana/savings'
import { getAvailableTotals, getReservedFlow, resolveMonthRange } from '@grana/dashboard'
import { supabase } from '../supabase'

/**
 * Native mirror of the web reads. The keys match the web ones on purpose: both
 * platforms invalidate the same trees after a save, and keeping them aligned is
 * what makes the mobile drawer refresh the dashboard row without extra wiring.
 */

/** The disponible real and the reserved stock, per currency. */
export function useAvailableTotals(asOfISO: string, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'available', asOfISO] as const,
    queryFn: () => getAvailableTotals(supabase, asOfISO),
    enabled,
  })
}

/** The month's net reserve flow, per currency. Feeds the savings row. */
export function useReservedFlow(year: number, month: number, todayISO: string, enabled = true) {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return useQuery({
    queryKey: ['dashboard', 'reserved-flow', key] as const,
    queryFn: () => {
      const { from, to } = resolveMonthRange(key)
      return getReservedFlow(supabase, from, to, todayISO)
    },
    enabled,
  })
}

/**
 * The sheet's own data: the stock per currency and the history. `staleTime: 0`
 * because these are the numbers the user just changed — a cached stock right
 * after saving would show the previous total on the screen that exists to audit
 * it.
 */
export function useSavingsDetail(enabled: boolean) {
  const [sums, ars, usd] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'sums'] as const,
        queryFn: () => getAvailableSums(supabase),
        enabled,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'ARS'] as const,
        queryFn: () => getReserveHistory(supabase, 'ARS'),
        enabled,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'USD'] as const,
        queryFn: () => getReserveHistory(supabase, 'USD'),
        enabled,
        staleTime: 0,
      },
    ],
  })

  const history: Record<'ARS' | 'USD', ReserveEntry[]> = {
    ARS: ars.data ?? [],
    USD: usd.data ?? [],
  }

  return { sums: (sums.data ?? null) as AvailableSums[] | null, history }
}
