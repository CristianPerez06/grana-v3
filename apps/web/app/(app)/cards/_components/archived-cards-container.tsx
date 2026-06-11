import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCards, type CreditCardSummary } from '@/lib/cards/queries'
import { ArchivedCardsSection } from './archived-cards-section'
import { SectionFallback } from '@/components/ui/section-fallback'

export const ArchivedCardsContainer = async () => {
  let archived: CreditCardSummary[]
  try {
    archived = await getCreditCards(await createClient(), { archivedOnly: true })
  } catch {
    const t = await getTranslations('cards.route')
    return <SectionFallback message={t('archived_error')} />
  }
  return <ArchivedCardsSection cards={archived} />
}
