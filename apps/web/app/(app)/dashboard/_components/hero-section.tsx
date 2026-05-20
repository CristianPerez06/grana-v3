import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MaskedAmount } from './masked-amount'
import type { DashboardHero } from '@/lib/dashboard/types'

type Props = {
  data: DashboardHero
}

export const HeroSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.hero')

  return (
    <Link
      href="/accounts"
      className="block rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  )
}
