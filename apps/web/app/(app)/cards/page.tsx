import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SectionFallback } from '../dashboard/_components/section-fallback'
import { ArchivedCardsContainer } from './_components/archived-cards-container'
import { CardsErrorBoundary } from './_components/cards-error-boundary'
import { CardsHeader } from './_components/cards-header'
import { CardsMonthHeroContainer } from './_components/cards-month-hero-container'
import { WalletContainer } from './_components/wallet-container'

const CardsPage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('cards.route')

  return (
    <div className="flex flex-col gap-6">
      <CardsHeader />

      <CardsErrorBoundary>
        <div className="flex flex-col gap-6">
          <Suspense
            fallback={
              <SectionFallback
                message={t('hero_loading')}
                className="min-h-[14rem]"
              />
            }
          >
            <CardsMonthHeroContainer />
          </Suspense>

          <Suspense
            fallback={
              <SectionFallback
                message={t('wallet_loading')}
                className="min-h-[18rem]"
              />
            }
          >
            <WalletContainer />
          </Suspense>

          <Suspense
            fallback={
              <SectionFallback
                message={t('archived_loading')}
                className="min-h-[3rem]"
              />
            }
          >
            <ArchivedCardsContainer />
          </Suspense>
        </div>
      </CardsErrorBoundary>
    </div>
  )
}

export default CardsPage
