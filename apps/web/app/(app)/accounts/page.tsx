import { Suspense } from 'react'
import { AccountsErrorBoundary } from './_components/accounts-error-boundary'
import { ActiveAccountsContainer } from './_components/active-accounts-container'
import { ActiveAccountsSkeleton } from './_components/active-accounts-skeleton'
import { ArchivedAccountsContainer } from './_components/archived-accounts-container'
import { ArchivedAccountsSkeleton } from './_components/archived-accounts-skeleton'

const AccountsPage = () => (
  <AccountsErrorBoundary>
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ActiveAccountsSkeleton />}>
        <ActiveAccountsContainer />
      </Suspense>

      <Suspense fallback={<ArchivedAccountsSkeleton />}>
        <ArchivedAccountsContainer />
      </Suspense>
    </div>
  </AccountsErrorBoundary>
)

export default AccountsPage
