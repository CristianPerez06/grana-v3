'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { AccountRowMenu } from './account-row-menu'

type Props = {
  account: AccountWithBalances
}

export const AccountRow = ({ account }: Props) => {
  const t = useTranslations('accounts')
  const showCents = useShowCents()

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <AccountAvatar {...account.avatar} size="md" />

      <Link
        href={`/accounts/${account.id}`}
        className="flex flex-1 items-center gap-4 min-w-0"
      >
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[15px] font-semibold text-text">
              {account.name}
            </span>
            {!account.is_active && (
              <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
                {t('badges.archived')}
              </span>
            )}
          </div>
          {account.type === 'bank' && account.institution && (
            <span className="truncate text-[13px] text-text-soft">
              {account.institution.name}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
          {hasARS && (
            <span className="text-[15px] font-semibold text-text">
              {formatARS(balances.ARS, showCents)}
            </span>
          )}
          {hasUSD && (
            <span className="text-[13px] text-text-soft">
              {formatUSD(balances.USD, showCents)}
            </span>
          )}
        </div>
      </Link>

      <div className="flex w-11 shrink-0 items-center justify-end sm:w-9">
        <AccountRowMenu account={account} />
      </div>
    </div>
  )
}
