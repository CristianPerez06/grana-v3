import type { AccountWithDetails } from '@/lib/accounts/types'
import { AccountRow } from './account-row'

type Props = {
  title: string
  accounts: AccountWithDetails[]
}

export const AccountSection = ({ title, accounts }: Props) => {
  if (accounts.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {title} ({accounts.length})
      </h2>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
      </div>
    </section>
  )
}
