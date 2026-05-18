import type { AccountWithBalances } from '@/lib/accounts/types'
import { AccountRow } from './account-row'

type Props = {
  title: string
  accounts: AccountWithBalances[]
  archived?: boolean
}

export const AccountSection = ({ title, accounts, archived = false }: Props) => {
  if (accounts.length === 0) return null

  return (
    <section className={archived ? 'opacity-70' : ''}>
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
