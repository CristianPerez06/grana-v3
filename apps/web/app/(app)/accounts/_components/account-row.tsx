'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { reactivateAccount } from '@/app/_actions/accounts'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'

type Props = {
  account: AccountWithBalances
}

export const AccountRow = ({ account }: Props) => {
  const t = useTranslations('accounts')
  const showCents = useShowCents()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(account.id)
      if (!result.ok) setError(result.formError ?? t('errors.reactivate_failed'))
    })
  }

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
          {error && <p className="text-[13px] text-destructive">{error}</p>}
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

      <div className="flex w-20 shrink-0 items-center justify-end">
        {account.is_active ? (
          <Link
            href={`/accounts/${account.id}/edit`}
            className="text-[13px] font-medium text-text-soft transition-colors hover:text-text"
          >
            {t('actions.edit')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleReactivate}
            disabled={isPending}
            className="text-[13px] font-semibold text-positive transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
          >
            {t('actions.reactivate')}
          </button>
        )}
      </div>
    </div>
  )
}
