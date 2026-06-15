'use client'

import { useTranslations } from 'next-intl'
import { Pencil } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { getAccountDetail } from '@/lib/accounts/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useEditAccountDrawer } from './edit-account-drawer'

type Props = {
  accountId: string
}

const heroCardCls =
  'bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border flex min-h-[238px] flex-col justify-between p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]'

export const AccountDetailHeader = ({ accountId }: Props) => {
  const t = useTranslations('accounts')
  const showCents = useShowCents()
  const editDrawer = useEditAccountDrawer()

  const accountQ = useQuery({
    queryKey: QUERY_KEYS.accountDetail(accountId),
    queryFn: () => getAccountDetail(createClient(), accountId),
  })

  const account = accountQ.data

  if (!account) {
    return (
      <div className={heroCardCls} aria-busy>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-[52px] shrink-0 rounded-2xl bg-navy-soft animate-pulse" />
            <div className="flex min-w-0 flex-col gap-2 pt-1">
              <div className="h-6 w-40 rounded bg-navy-soft animate-pulse" />
              <div className="h-3.5 w-28 rounded bg-navy-soft animate-pulse" />
            </div>
          </div>
          <div className="size-[38px] shrink-0 rounded-xl bg-navy-soft animate-pulse" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-2.5 w-16 rounded bg-navy-soft animate-pulse" />
          <div className="h-10 w-56 rounded bg-navy-soft animate-pulse" />
          <div className="h-5 w-32 rounded bg-navy-soft animate-pulse" />
        </div>
      </div>
    )
  }

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')
  // Subtitle: bank → "<institution> · <type>"; cash → just the type label.
  // Credit accounts are redirected server-side to /cards/[id] so we never
  // render them here, but we still pick a safe fallback.
  const typeLabel =
    account.type === 'bank' ? t('types.bank') : account.type === 'cash' ? t('types.cash') : ''
  const subtitle =
    account.type === 'bank' && account.institution
      ? `${account.institution.name} · ${typeLabel}`
      : typeLabel

  return (
    <div className={heroCardCls}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AccountAvatar {...account.avatar} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[25px] font-extrabold leading-tight">
                {account.name}
              </h1>
              {!account.is_active && (
                <span className="inline-flex h-6 items-center rounded-full bg-navy-soft px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald">
                  {t('badges.archived')}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[13px] text-navy-muted">{subtitle}</p>
          </div>
        </div>

        {editDrawer ? (
          <button
            type="button"
            onClick={editDrawer.openEdit}
            aria-label={t('actions.edit')}
            title={t('actions.edit')}
            className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl border border-navy-border bg-navy-soft text-white hover:bg-white/15 transition-colors"
          >
            <Pencil className="size-[16px]" aria-hidden />
          </button>
        ) : (
          <a
            href={`/accounts/${accountId}/edit`}
            aria-label={t('actions.edit')}
            title={t('actions.edit')}
            className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl border border-navy-border bg-navy-soft text-white hover:bg-white/15 transition-colors"
          >
            <Pencil className="size-[16px]" aria-hidden />
          </a>
        )}
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/60">
          {t('labels.balance')}
        </p>
        {hasARS && (
          <p className="mt-2 text-[42px] font-black leading-none tabular-nums sm:text-[42px]">
            {formatARS(balances.ARS, showCents)}
          </p>
        )}
        {hasUSD && (
          <p className="mt-2.5 text-lg font-extrabold tabular-nums text-white/75">
            {formatUSD(balances.USD, showCents)}
          </p>
        )}
      </div>
    </div>
  )
}
