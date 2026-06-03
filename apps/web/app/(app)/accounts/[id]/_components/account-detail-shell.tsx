'use client'

import { FiltersProvider } from '@/lib/transactions/filters-context'
import { EditAccountDrawerLoader } from './edit-account-drawer-loader'
import { AccountDetailContent } from './account-detail-content'

type Props = {
  accountId: string
}

/**
 * Top-level client shell for /accounts/[id]. The TanStack QueryClient is
 * mounted at the (app) layout level (`AppQueryProvider`), so this shell only
 * has to add the route-specific filters context and the drawer loader on top.
 *
 * The drawer loader sits above the content so the content's `useEditAccountDrawer`
 * consumers see the provider as soon as it mounts (account + institutions
 * resolved). Until then it renders children directly and consumers see null
 * (the header treats that as "fall back to the /edit page link").
 */
export function AccountDetailShell({ accountId }: Props) {
  return (
    <FiltersProvider>
      <EditAccountDrawerLoader accountId={accountId}>
        <AccountDetailContent accountId={accountId} />
      </EditAccountDrawerLoader>
    </FiltersProvider>
  )
}
