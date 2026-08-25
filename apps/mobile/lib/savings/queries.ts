import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getAvailableSums,
  getReserveFlowSums,
  getReserveHistory,
  type AvailableSums,
  type ReserveEntry,
} from '@grana/savings'
import { getAvailableTotals } from '@grana/dashboard'
import { formatDateISO } from '@grana/money-logic'
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

/**
 * The sheet's own data: the stock per currency and the history. `staleTime: 0`
 * because these are the numbers the user just changed — a cached stock right
 * after saving would show the previous total on the screen that exists to audit
 * it.
 */
export function useSavingsDetail(enabled: boolean, monthStart: Date, today: Date) {
  const [sums, ars, usd, flow] = useQueries({
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
      {
        // "Este mes" sale de la MISMA lectura normativa que la fila del
        // dashboard: sumarlo acá filtrando el historial sería una segunda
        // implementación del mismo número, con floats crudos y sin corte
        // temporal.
        queryKey: ['savings', 'flow', formatDateISO(monthStart)] as const,
        queryFn: () => getReserveFlowSums(supabase, monthStart, today),
        enabled,
        staleTime: 0,
      },
    ],
  })

  const empty = { entries: [] as ReserveEntry[], hasMore: false }
  const history: Record<'ARS' | 'USD', { entries: ReserveEntry[]; hasMore: boolean }> = {
    ARS: ars.data ?? empty,
    USD: usd.data ?? empty,
  }

  const monthNet = (currency: 'ARS' | 'USD'): number =>
    flow.data?.find((f) => f.currencyCode === currency)?.reservedNet ?? 0

  return { sums: (sums.data ?? null) as AvailableSums[] | null, history, monthNet }
}
