import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardHero } from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'

type Props = {
  data: DashboardHero
}

// "Dónde está" — the per-account breakdown next to the hero. Rows come from
// the same getDashboardHero call (already sorted by ARS balance desc); the
// closing row is the total USD holding (a stock, not a per-account split).
// Capped so the top row keeps a sane height; the full list lives in /accounts.
const MAX_ACCOUNTS = 6

export const AccountsCard = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.accounts')
  const accounts = data.accounts.slice(0, MAX_ACCOUNTS)

  return (
    <Card className="flex min-h-[13rem] flex-col">
      <CardHeader className="gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-text">{t('title')}</h2>
        <Link
          href="/accounts"
          className="text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t('view_all')}
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <ul className="flex flex-col">
          {accounts.map((account, index) => (
            <li
              key={account.id}
              className={cn(
                'flex items-start gap-3 py-[11px] sm:items-center',
                index > 0 && 'border-t border-border-soft',
              )}
            >
              <AccountAvatar {...account.avatar} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 text-sm font-bold text-text line-clamp-2 sm:line-clamp-none sm:truncate">
                  {account.name}
                </span>
                <span
                  className={cn(
                    'block w-full border-t border-border-soft pt-2 text-[14.5px] font-extrabold tracking-tight tabular-nums sm:w-auto sm:border-0 sm:pt-0',
                    account.ars === 0 ? 'text-text-soft' : 'text-text',
                  )}
                >
                  <MaskedAmount amount={account.ars} currency="ARS" />
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* USD holding — the bimoneda closing row, emerald like the handoff. */}
        <div className="mt-auto flex items-start gap-3 border-t border-border-soft pt-3 sm:items-center">
          <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-[3px] bg-emerald sm:mt-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-emerald-deep">
              {t('usd_row')}
            </span>
            <span className="block w-full border-t border-border-soft pt-2 text-[14.5px] font-extrabold tracking-tight tabular-nums text-emerald-deep sm:w-auto sm:border-0 sm:pt-0">
              <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
