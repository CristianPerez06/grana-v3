import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getAvailableSums,
  getPurposeSums,
  getReserveFlowSums,
  getAllocationHistory,
  getReserveHistory,
  listPurposes,
  type AvailableSums,
  type Purpose,
  type PurposeSums,
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
  const [sums, history, flow, purposeSums, purposes] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'sums'] as const,
        queryFn: () => getAvailableSums(supabase),
        enabled,
        staleTime: 0,
      },
      {
        // Las dos monedas en UNA lista: el detalle ya no está partido por
        // moneda, así que su historial tampoco.
        queryKey: ['savings', 'history', 'all'] as const,
        queryFn: () => getReserveHistory(supabase),
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
      {
        // El corte por propósito, de la misma lectura normativa que usa el piso
        // del write path. La suma de estos grupos ES el `reserved` de arriba.
        queryKey: ['savings', 'purpose-sums'] as const,
        queryFn: () => getPurposeSums(supabase),
        enabled,
        staleTime: 0,
      },
      {
        // Lectura aparte y NO de plata: incluye los propósitos que todavía no
        // tienen nada guardado, que no aparecen en el corte.
        queryKey: ['savings', 'purposes'] as const,
        queryFn: () => listPurposes(supabase),
        enabled,
        staleTime: 0,
      },
    ],
  })

  const monthNet = (currency: 'ARS' | 'USD'): number =>
    flow.data?.find((f) => f.currencyCode === currency)?.reservedNet ?? 0

  return {
    sums: (sums.data ?? null) as AvailableSums[] | null,
    history: (history.data ?? { entries: [] as ReserveEntry[], hasMore: false }) as {
      entries: ReserveEntry[]
      hasMore: boolean
    },
    monthNet,
    purposeSums: (purposeSums.data ?? []) as PurposeSums[],
    purposes: (purposes.data ?? []) as Purpose[],
  }
}

/**
 * El historial de UN propósito: sus REPARTOS, no reservas.
 *
 * Son dos actos distintos —guardar mueve el disponible, apartar no— y por eso
 * son dos listas. «Sin destino» no tiene: es el resto, no tiene actos propios.
 */
export function usePurposeHistory(
  enabled: boolean,
  currency: 'ARS' | 'USD',
  purposeId: string | null,
) {
  return useQuery({
    queryKey: ['savings', 'allocations', currency, purposeId ?? 'none'] as const,
    queryFn: () => getAllocationHistory(supabase, currency, purposeId as string),
    enabled: enabled && purposeId != null,
    staleTime: 0,
  })
}
