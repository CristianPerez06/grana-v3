'use client'

import { type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  getAccountDetailAction,
  getInstitutionsAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { EditAccountDrawerProvider } from './edit-account-drawer'

type Props = {
  accountId: string
  children: ReactNode
}

/**
 * Mounts `<EditAccountDrawerProvider>` only when both `account` (with
 * institution + currencies — the form needs them prefilled) and the
 * `institutions` catalog are loaded. Renders children directly otherwise so
 * the rest of the shell paints without blocking on the drawer.
 *
 * Until the provider mounts, `useEditAccountDrawer()` consumers return null,
 * which the header reads as "fall back to the /edit page link". Same UX as
 * the no-JS / degraded-mode fallback that already existed in the component.
 */
export function EditAccountDrawerLoader({ accountId, children }: Props) {
  const [accountQ, institutionsQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.accountDetail(accountId),
        queryFn: () => getAccountDetailAction(accountId),
      },
      {
        queryKey: QUERY_KEYS.institutions,
        queryFn: () => getInstitutionsAction(),
      },
    ],
  })

  if (!accountQ.data || !institutionsQ.data) {
    return <>{children}</>
  }

  return (
    <EditAccountDrawerProvider account={accountQ.data} institutions={institutionsQ.data}>
      {children}
    </EditAccountDrawerProvider>
  )
}
