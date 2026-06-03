'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  MovementFilters,
  type MovementFiltersController,
} from '@/lib/transactions/components/movement-filters'
import {
  getAccountMovementsAscendingAction,
  getMovementFilterOptionsAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { adaptFiltersForQuery } from '@/lib/transactions/filters-state'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'

type Props = {
  accountId: string
}

/**
 * /accounts/[id] variant of the MovementFilters container. Behaves like the
 * /transactions one (controller dispatches to the reducer) but:
 * - hides the account filter (`showAccountFilter={false}` — already scoped),
 * - reads the list's loading state from the ascending-history query (same
 *   key the list container uses, so TanStack dedupes — zero extra fetch),
 * - renders its own month nav (this route has no overview card that owns it).
 */
export function MovementFiltersAccountContainer({ accountId }: Props) {
  const { filters, dispatch } = useTransactionsFilters()

  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters])

  const [filterOptionsQ, ascendingQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.transactionsFilterOptions(filters.categoryId),
        queryFn: () =>
          getMovementFilterOptionsAction({ categoryId: filters.categoryId ?? undefined }),
      },
      {
        queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
        queryFn: () => getAccountMovementsAscendingAction(accountId),
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
      onClearAll: () => dispatch({ type: 'clearAll' }),
    }),
    [dispatch, filters.amountMin, filters.amountMax],
  )

  return (
    <MovementFilters
      filters={adapted}
      accounts={filterOptions?.accounts ?? []}
      categories={filterOptions?.categories ?? []}
      subcategories={filterOptions?.subcategories ?? []}
      showAccount={false}
      showAccountFilter={false}
      showMonthNav
      controller={controller}
      disabled={listLoading}
    />
  )
}
