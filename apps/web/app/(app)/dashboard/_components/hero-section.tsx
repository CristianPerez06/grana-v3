import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardHero } from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'

type Props = {
  data: DashboardHero
}

// "Para gastar · hoy" — the dark hero card of the dashboard redesign: today's
// available balance, ARS as the headline and USD as a subordinate chip line.
// The per-account breakdown lives in the sibling AccountsCard ("Dónde está").
export const HeroSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.hero')

  return (
    <Card className="flex min-h-[13rem] flex-col border-transparent bg-surface-dark text-white">
      <CardContent className="flex flex-1 flex-col p-6">
        {/* The amounts block centers vertically in the space above the caption
            (the card stretches to match the accounts card next to it). */}
        <div className="flex flex-1 flex-col justify-center">
          <Link
            href="/accounts"
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/55">
              {t('eyebrow')}
            </p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-white/50">{t('question')}</p>
            <p className="mt-2 text-[clamp(2.125rem,4.6vw,2.875rem)] font-extrabold leading-none tracking-tight">
              <MaskedAmountDisplay amount={data.ars} currency="ARS" />
            </p>
            <p className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald">
                USD
              </span>
              <span className="text-[15.5px] font-bold text-white/90">
                <MaskedAmount amount={data.usd} currency="USD" showCentsOverride />
              </span>
            </p>
          </Link>
        </div>
        <p className="pt-5 text-[12.5px] font-semibold text-white/50">
          {t('caption')}
        </p>
      </CardContent>
    </Card>
  )
}
