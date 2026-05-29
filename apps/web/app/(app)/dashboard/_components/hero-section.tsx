import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { MaskedAmount } from './masked-amount'
import { AccountAvatar } from '@/components/ui/account-avatar'
import type { DashboardHero } from '@grana/dashboard'

type Props = {
  data: DashboardHero
}

// Desktop breakdown shows the top cash/bank accounts; the rest live in /accounts.
const MAX_BREAKDOWN_ACCOUNTS = 3

export const HeroSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.hero')
  const breakdown = data.accounts.slice(0, MAX_BREAKDOWN_ACCOUNTS)

  return (
    <div className="min-h-[10rem] rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <Link
          href="/accounts"
          className="block rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-1"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('label')}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-text">
            <MaskedAmount amount={data.ars} currency="ARS" />
          </p>
          <p className="mt-1 text-sm text-text-muted">
            <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
          </p>
        </Link>

        {breakdown.length > 0 && (
          <div className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:gap-3 lg:border-l lg:border-border-soft lg:pl-6">
            <ul className="flex flex-col gap-2">
              {breakdown.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <AccountAvatar {...account.avatar} size="sm" />
                    <span className="truncate text-sm text-text">
                      {account.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-text">
                    <MaskedAmount amount={account.ars} currency="ARS" />
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/accounts"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald transition-colors hover:text-emerald-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {t('view_all_accounts')}
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
