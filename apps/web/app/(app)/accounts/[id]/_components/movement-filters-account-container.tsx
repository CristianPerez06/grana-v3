'use client'

import { useMemo, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  MovementFilters,
  type MovementFiltersController,
} from '@/lib/transactions/components/movement-filters'
import {
  getAccountMovementsAscending,
  getMovementFilterOptions,
} from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { adaptFiltersForQuery } from '@/lib/transactions/filters-state'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'
import { useAccountCurrencyLens } from './use-account-currency-lens'

type Props = {
  accountId: string
  /** Title + ARS | USD lens, drawn on the toolbar row (left). */
  leading?: ReactNode
  /** «+ Agregar», drawn after the three icons. */
  trailing?: ReactNode
}

/**
 * /accounts/[id] variant of the MovementFilters container. Behaves like the
 * /transactions one (controller dispatches to the reducer) but:
 * - hides the account filter (`showAccountFilter={false}` — already scoped),
 * - reads the list's loading state from the ascending-history query (same
 *   key the list container uses, so TanStack dedupes — zero extra fetch),
 * - renders its own month nav (this route has no overview card that owns it).
 */
export function MovementFiltersAccountContainer({ accountId, leading, trailing }: Props) {
  const { filters, dispatch } = useTransactionsFilters()
  const currencyLens = useAccountCurrencyLens(accountId)

  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters])

  const [filterOptionsQ, ascendingQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.transactionsFilterOptions(filters.categoryId),
        queryFn: () =>
          getMovementFilterOptions(createClient(), {
            categoryId: filters.categoryId ?? undefined,
          }),
      },
      {
        queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
        queryFn: () => getAccountMovementsAscending(createClient(), accountId),
      },
    ],
  })
  const filterOptions = filterOptionsQ.data
  const listLoading = ascendingQ.isPending

  const controller: MovementFiltersController = useMemo(
    () => ({
      onSetQuery: (query) => dispatch({ type: 'setQuery', query }),
      onSetType: (movementType) => dispatch({ type: 'setType', movementType }),
      onSetAccount: (accountId) => dispatch({ type: 'setAccount', accountId }),
      onSetCategory: (categoryId) => dispatch({ type: 'setCategory', categoryId }),
      onSetSubcategory: (subcategoryId) =>
        dispatch({ type: 'setSubcategory', subcategoryId }),
      onSetCurrency: (currency) => dispatch({ type: 'setCurrency', currency }),
      onSetAmountMin: (min) =>
        dispatch({ type: 'setAmountRange', min, max: filters.amountMax }),
      onSetAmountMax: (max) =>
        dispatch({ type: 'setAmountRange', min: filters.amountMin, max }),
      onSetMonth: (month) => dispatch({ type: 'setMonth', month }),
      onSetCustomRange: (range) => dispatch({ type: 'setCustomRange', range }),
      onClearAll: () => {
        dispatch({ type: 'clearAll' })
        // Here the date range is a filter like the others: «Limpiar todo» clears it.
        dispatch({ type: 'setCustomRange', range: null })
        // «Limpiar todo» clears filters; the currency lens is not one of them.
        if (currencyLens.show && filters.currency) {
          dispatch({ type: 'setCurrency', currency: filters.currency })
        }
      },
    }),
    [dispatch, filters.amountMin, filters.amountMax, filters.currency, currencyLens.show],
  )

  return (
    <MovementFilters
      filters={adapted}
      accounts={filterOptions?.accounts ?? []}
      categories={filterOptions?.categories ?? []}
      subcategories={filterOptions?.subcategories ?? []}
      showAccount={false}
      showAccountFilter={false}
      showCurrencyFilter={!currencyLens.show}
      showDateRange
      showMonthNav={false}
      leading={leading}
      trailing={trailing}
      controller={controller}
      disabled={listLoading}
    />
  )
}
