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
    <div className="flex min-h-[78px] items-start gap-4 px-5 py-4 sm:items-center">
      <AccountAvatar {...account.avatar} size="md" />

      <Link
        href={`/accounts/${account.id}`}
        className="flex flex-1 flex-col gap-2.5 min-w-0 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="max-w-full text-[15px] font-semibold text-text break-words sm:truncate">
              {account.institution?.name ?? account.name}
            </span>
            {!account.is_active && (
              <span className="inline-flex shrink-0 min-h-[22px] items-center rounded-full bg-warning-soft px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-warning">
                {t('badges.archived')}
              </span>
            )}
          </div>
          {account.institution && account.institution.name !== account.name && (
            <span className="block max-w-full text-[13px] text-text-soft break-words sm:truncate">
              {account.name}
            </span>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col items-start gap-0.5 border-t border-border-soft pt-2.5 tabular-nums sm:w-auto sm:items-end sm:border-0 sm:pt-0">
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
