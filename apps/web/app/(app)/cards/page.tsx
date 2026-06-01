import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCards, getCardsMonthSummary, getCardNetworks } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { getTodayAR } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { CardsMonthHero } from './_components/cards-month-hero'
import { WalletGrid } from './_components/wallet-grid'
import { ArchivedCardsSection } from './_components/archived-cards-section'

const CardsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [allCards, monthSummary, networks, showCents, locale, t] = await Promise.all([
    getCreditCards({ includeArchived: true }),
    getCardsMonthSummary(),
    getCardNetworks(),
    getShowCents(),
    getLocale(),
    getTranslations('cards'),
  ])

  const activeCards = allCards.filter((c) => c.is_active)
  const archivedCards = allCards.filter((c) => !c.is_active)

  const networkNames: Record<string, string> = Object.fromEntries(
    networks.map((n) => [n.id, n.name]),
  )

  const today = getTodayAR()
  const monthLabel = today.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
    month: 'long',
    year: 'numeric',
  })
  const monthShort = today.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
    month: 'long',
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('wallet.subtitle', { count: activeCards.length, month: monthLabel })}
        actions={
          <Button asChild className="w-auto">
            <Link href="/cards/new">
              <Plus className="size-4" aria-hidden />
              {t('actions.add_label')}
            </Link>
          </Button>
        }
      />

      <CardsMonthHero summary={monthSummary} showCents={showCents} />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{t('wallet.section_title')}</h2>
          {activeCards.length > 0 && (
            <span className="text-xs text-text-muted">{t('wallet.section_hint')}</span>
          )}
        </div>

        <WalletGrid
          cards={activeCards}
          networkNames={networkNames}
          monthLabel={monthShort}
          showCents={showCents}
        />
      </section>

      <ArchivedCardsSection cards={archivedCards} />
    </div>
  )
}

export default CardsPage
