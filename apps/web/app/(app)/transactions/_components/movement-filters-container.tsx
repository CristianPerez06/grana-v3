'use client'

import { useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  MovementFilters,
  type MovementFiltersController,
} from '@/lib/transactions/components/movement-filters'
import { createClient } from '@/lib/supabase/client'
import {
  getGlobalMovementsPage,
  getMovementFilterOptions,
} from '@/lib/transactions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { adaptFiltersForQuery } from '@/lib/transactions/filters-state'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'

/**
 * Client container for `<MovementFilters>`. Reads the React-state filters,
 * fetches the per-category filter-options (accounts, categories, subcategories)
 * via TanStack Query, and wires a controller that dispatches reducer actions
 * for every mutation (chip removal, search debounce, sheet selectors, etc.).
 *
 * The legacy `<MovementFilters>` component supports both modes (URL fallback
 * vs controller); we always pass the controller here so URL navigation never
 * fires from this route.
 */
/**
 * localStorage key for the persisted "show shared movements" preference. Scoped
 * to the global Movimientos module; the account detail view does not read it.
 */
const SHOW_SHARED_KEY = 'grana:tx:showShared'

export function MovementFiltersContainer() {
  const { filters, dispatch } = useTransactionsFilters()

  // Hydrate the persisted "show shared" preference once on mount. Default is ON
  // (shared shown); only restore when the user previously turned it OFF, so a
  // brand-new user incurs no extra fetch. Reading localStorage in an effect
  // (browser-only) avoids any SSR hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(SHOW_SHARED_KEY) === 'false') {
      dispatch({ type: 'setShowShared', value: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleShared = () => {
    const next = !filters.showShared
    dispatch({ type: 'setShowShared', value: next })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SHOW_SHARED_KEY, String(next))
    }
  }

  // Filter-options change when the active categoryId changes (subcategory list
  // depends on it); the queryKey includes it so each category fetches its own
  // option set. The movement page query is also read here — TanStack dedupes
  // it with the list container by queryKey, so this is a free lookup that lets
  // the toolbar buttons reflect the list's loading state without adding I/O.
  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters])
  const [filterOptionsQ, pageQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.transactionsFilterOptions(filters.categoryId),
        queryFn: () =>
          getMovementFilterOptions(createClient(), { categoryId: filters.categoryId ?? undefined }),
      },
      {
        queryKey: QUERY_KEYS.transactionsPage(filters.limit, adapted),
        queryFn: () =>
          getGlobalMovementsPage(createClient(), { limit: filters.limit, filters: adapted }),
      },
    ],
  })
  const filterOptions = filterOptionsQ.data
  const listLoading = pageQ.isPending

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

  // Until filter options resolve, render the filters with empty option arrays —
  // the search input still works (it doesn't depend on options) and the sheet
  // selectors fall back to empty selects. The first paint cost is well worth
  // not blocking the search affordance behind a skeleton.
  return (
    <MovementFilters
      filters={adapted}
      accounts={filterOptions?.accounts ?? []}
      categories={filterOptions?.categories ?? []}
      subcategories={filterOptions?.subcategories ?? []}
      showAccount={(filterOptions?.accounts.length ?? 0) >= 2}
      showMonthNav={false}
      controller={controller}
      sharedToggle={{ active: filters.showShared, onToggle: toggleShared }}
      disabled={listLoading}
    />
  )
}
