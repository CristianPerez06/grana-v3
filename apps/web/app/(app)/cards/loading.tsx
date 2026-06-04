import { ArchivedCardsSkeleton } from './_components/archived-cards-skeleton'
import { CardsMonthHeroSkeleton } from './_components/cards-month-hero-skeleton'
import { WalletSkeleton } from './_components/wallet-skeleton'

const CardsLoading = () => (
  <div className="flex flex-col gap-6">
    <CardsMonthHeroSkeleton />
    <WalletSkeleton />
    <ArchivedCardsSkeleton />
  </div>
)

export default CardsLoading
