'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import {
  createInitialFilters,
  transactionsFiltersReducer,
  type TransactionsFilters,
  type TransactionsFiltersAction,
} from './filters-state'

type FiltersContextValue = {
  filters: TransactionsFilters
  dispatch: React.Dispatch<TransactionsFiltersAction>
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

type Props = {
  children: ReactNode
  /** Test seam: lets storybook / tests inject a deterministic initial state. */
  initialState?: TransactionsFilters
}

export function FiltersProvider({ children, initialState }: Props) {
  const [filters, dispatch] = useReducer(
    transactionsFiltersReducer,
    initialState,
    (seed) => seed ?? createInitialFilters(),
  )
  const value = useMemo(() => ({ filters, dispatch }), [filters])
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

/**
 * Consume the transactions filter state + dispatcher. Throws when used outside
 * the provider so misuse is loud (instead of silently rendering with stale or
 * empty defaults).
 */
export function useTransactionsFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext)
  if (!ctx) {
    throw new Error('useTransactionsFilters must be used within <FiltersProvider>')
  }
  return ctx
}
