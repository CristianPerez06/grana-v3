import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCreditCards } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { PageHeader } from '@/components/ui/page-header'
import { CreditCardCarousel } from './_components/credit-card-carousel'
import { ArchivedCardsSection } from './_components/archived-cards-section'

const CardsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [allCards, showCents] = await Promise.all([
    getCreditCards({ includeArchived: true }),
    getShowCents(),
  ])

  const activeCards = allCards.filter((c) => c.is_active)
  const archivedCards = allCards.filter((c) => !c.is_active)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tarjetas"
        actions={
          <Link
            href="/cards/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Agregar tarjeta
          </Link>
        }
      />

      <CreditCardCarousel cards={activeCards} showCents={showCents} />

      <ArchivedCardsSection cards={archivedCards} />
    </div>
  )
}

export default CardsPage
