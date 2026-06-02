import { getTranslations } from 'next-intl/server'
import { getCardsMonthSummary, type CardsMonthSummary } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { CardsMonthHero } from './cards-month-hero'
import { SectionFallback } from '@/components/ui/section-fallback'

export const CardsMonthHeroContainer = async () => {
  let summary: CardsMonthSummary
  let showCents: boolean
  try {
    ;[summary, showCents] = await Promise.all([
      getCardsMonthSummary(),
      getShowCents(),
    ])
  } catch {
    const t = await getTranslations('cards.route')
    return <SectionFallback message={t('hero_error')} />
  }
  return <CardsMonthHero summary={summary} showCents={showCents} />
}
