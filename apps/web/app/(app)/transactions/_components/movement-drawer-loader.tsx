'use client'

import { useMemo, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  getAccountsAction,
  getAllCategoriesAction,
  getHouseholdAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import type { MovementFormAccount } from '@/lib/transactions/components/movement-form'
import { MovementDrawerProvider } from './movement-drawer'

type Props = {
  children: ReactNode
}

type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

/**
 * Loader that resolves the data the create-movement drawer needs (`accounts`,
 * `categories`, `household`) via TanStack Query and mounts
 * `<MovementDrawerProvider>` once it's all ready. Children render either way:
 * when the queries are pending or errored, children render outside the drawer
 * context (so `useMovementDrawer()` returns `null` and CTAs across the app
 * render visually disabled — see `RegisterMovementButton`, `QuickAddFab`, etc.).
 *
 * Mounted inside `AppShell` around the `{children}` slot, so the drawer is
 * available from any authenticated route. The queries share their `queryKey`
 * with `<TransactionsHeader>` and other consumers, so TanStack dedupes the
 * fetches: the network roundtrip happens once.
 */
export function MovementDrawerLoader({ children }: Props) {
  const queries = useQueries({
    queries: [
      { queryKey: QUERY_KEYS.accountsList, queryFn: () => getAccountsAction() },
      { queryKey: QUERY_KEYS.categoriesTree, queryFn: () => getAllCategoriesAction() },
      { queryKey: QUERY_KEYS.householdDetail, queryFn: () => getHouseholdAction() },
    ],
  })

  const [accountsQ, categoriesQ, householdQ] = queries
  const accountsData = accountsQ.data
  const categoriesData = categoriesQ.data
  const householdData = householdQ.data

  const drawerAccounts = useMemo<MovementFormAccount[] | null>(() => {
    if (!accountsData) return null
    return [
      ...[...accountsData.cash, ...accountsData.bank].map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as 'cash' | 'bank',
        activeCurrencies: activeCodes(a.currencies),
        balances: a.balances,
        institutionId: a.institution_id ?? null,
        avatar: a.avatar,
      })),
      ...accountsData.credit.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'credit' as const,
        activeCurrencies: activeCodes(c.currencies),
        balances: { ARS: 0, USD: 0 },
        institutionId: c.institution_id ?? null,
      })),
    ]
  }, [accountsData])

  // Drawer only mounts when all three are ready; otherwise children render
  // without context (and the button stays disabled via TransactionsHeader's
  // own useQueries).
  if (drawerAccounts && categoriesData && householdData !== undefined) {
    return (
      <MovementDrawerProvider
        accounts={drawerAccounts}
        categories={categoriesData}
        household={householdData}
      >
        {children}
      </MovementDrawerProvider>
    )
  }

  return <>{children}</>
}
