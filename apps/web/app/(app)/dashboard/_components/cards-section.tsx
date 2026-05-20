'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CreditCardCarousel } from '@/app/(app)/cards/_components/credit-card-carousel'
import { useShowCents } from '@/lib/preferences-context'
import { useEyeMask } from './eye-mask-context'
import type { CreditCardSummary } from '@/lib/dashboard/queries'

type Props = {
  cards: CreditCardSummary[]
}

export const CardsSection = ({ cards }: Props) => {
  const t = useTranslations('dashboard.cards')
  const showCents = useShowCents()
  const { masked } = useEyeMask()

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
      </header>
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-muted">{t('empty_title')}</p>
          <Link
            href="/cards/new"
            className="inline-flex items-center gap-1 rounded-md bg-emerald px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-deep"
          >
            + {t('empty_cta')}
          </Link>
        </div>
      ) : (
        <CreditCardCarousel cards={cards} showCents={showCents} masked={masked} />
      )}
    </section>
  )
}
