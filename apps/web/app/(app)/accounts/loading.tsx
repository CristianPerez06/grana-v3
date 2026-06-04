import { ActiveAccountsSkeleton } from './_components/active-accounts-skeleton'
import { ArchivedAccountsSkeleton } from './_components/archived-accounts-skeleton'

const AccountsLoading = () => (
  <div className="flex flex-col gap-6">
    <ActiveAccountsSkeleton />
    <ArchivedAccountsSkeleton />
  </div>
)

export default AccountsLoading
