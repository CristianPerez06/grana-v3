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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-soft">
          {title}
        </h2>
        <span className="text-xs font-medium text-text-soft/80">· {accounts.length}</span>
      </div>
      <div
        className={`flex flex-col divide-y divide-border-soft rounded-2xl bg-card ${
          archived ? 'border border-dashed border-border-soft' : 'border border-border-soft'
        }`}
      >
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
      </div>
    </section>
  )
}
