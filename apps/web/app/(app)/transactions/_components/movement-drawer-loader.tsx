'use client'

import { useMemo, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getAccounts } from '@/lib/accounts/queries'
import { toFormAccounts } from '@/lib/accounts/form-accounts'
import { getAllCategories } from '@/lib/categories/queries'
import { getFrequentClassifications } from '@/app/_actions/frequent-classifications'
import { getHousehold } from '@grana/shared'
import { getAppStartDate } from '@/lib/profile/queries'
import { hasAnyTransaction } from '@/lib/transactions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import type { MovementFormAccount } from '@/lib/transactions/components/movement-form'
import { MovementDrawerProvider } from './movement-drawer'

type Props = {
  children: ReactNode
}

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
      { queryKey: QUERY_KEYS.accountsList, queryFn: () => getAccounts(createClient()) },
      { queryKey: QUERY_KEYS.categoriesTree, queryFn: () => getAllCategories(createClient()) },
      { queryKey: QUERY_KEYS.householdDetail, queryFn: () => getHousehold(createClient()) },
      { queryKey: ['transactionsHasAny'], queryFn: () => hasAnyTransaction(createClient()) },
      { queryKey: QUERY_KEYS.appStartDate, queryFn: () => getAppStartDate(createClient()) },
      // Non-critical accelerator (#31 item 1): must never gate the drawer open.
      { queryKey: ['frequentClassifications'], queryFn: () => getFrequentClassifications() },
    ],
  })

  const [accountsQ, categoriesQ, householdQ, hasAnyTxQ, appStartDateQ, frequentQ] = queries
  const accountsData = accountsQ.data
  const categoriesData = categoriesQ.data
  const householdData = householdQ.data
  const hasAnyTxData = hasAnyTxQ.data
  const appStartDate = (appStartDateQ.data as string | null | undefined) ?? null

  const drawerAccounts = useMemo<MovementFormAccount[] | null>(
    () => (accountsData ? toFormAccounts(accountsData) : null),
    [accountsData],
  )

  // Drawer only mounts when all queries are ready; otherwise children render
  // without context (and the button stays disabled via TransactionsHeader's
  // own useQueries).
  if (
    drawerAccounts &&
    categoriesData &&
    householdData !== undefined &&
    hasAnyTxData !== undefined &&
    appStartDateQ.data !== undefined
  ) {
    return (
      <MovementDrawerProvider
        accounts={drawerAccounts}
        categories={categoriesData}
        frequentClassifications={frequentQ.data ?? undefined}
        household={householdData}
        appStartDate={appStartDate}
        showFirstMovementGuidance={!hasAnyTxData}
      >
        {children}
      </MovementDrawerProvider>
    )
  }

  return <>{children}</>
}
