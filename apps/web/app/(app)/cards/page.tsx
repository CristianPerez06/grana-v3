import { Suspense } from 'react'
import { ArchivedCardsContainer } from './_components/archived-cards-container'
import { ArchivedCardsSkeleton } from './_components/archived-cards-skeleton'
import { CardsErrorBoundary } from './_components/cards-error-boundary'
import { CardsMonthHeroContainer } from './_components/cards-month-hero-container'
import { CardsMonthHeroSkeleton } from './_components/cards-month-hero-skeleton'
import { WalletContainer } from './_components/wallet-container'
import { WalletSkeleton } from './_components/wallet-skeleton'

const CardsPage = () => (
  <CardsErrorBoundary>
    <div className="flex flex-col gap-6">
      <Suspense fallback={<CardsMonthHeroSkeleton />}>
        <CardsMonthHeroContainer />
      </Suspense>

      <Suspense fallback={<WalletSkeleton />}>
        <WalletContainer />
      </Suspense>

      <Suspense fallback={<ArchivedCardsSkeleton />}>
        <ArchivedCardsContainer />
      </Suspense>
    </div>
  </CardsErrorBoundary>
)

export default CardsPage
