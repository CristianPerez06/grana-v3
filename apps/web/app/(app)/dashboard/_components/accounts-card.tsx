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
      <CardHeader className="flex-row items-center justify-between gap-2 pb-1">
        <h2 className="text-base font-bold tracking-tight text-text">{t('title')}</h2>
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
                'flex items-center gap-3 py-[11px]',
                index > 0 && 'border-t border-border-soft',
              )}
            >
              <AccountAvatar {...account.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                {account.name}
              </span>
              <span
                className={cn(
                  'shrink-0 text-[14.5px] font-extrabold tracking-tight',
                  account.ars === 0 ? 'text-text-soft' : 'text-text',
                )}
              >
                <MaskedAmount amount={account.ars} currency="ARS" />
              </span>
            </li>
          ))}
        </ul>

        {/* USD holding — the bimoneda closing row, emerald like the handoff. */}
        <div className="mt-auto flex items-center gap-3 border-t border-border-soft pt-3">
          <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-emerald" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-emerald-deep">
            {t('usd_row')}
          </span>
          <span className="shrink-0 text-[14.5px] font-extrabold tracking-tight text-emerald-deep">
            <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
