import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCards } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { PageHeader } from '@/components/ui/page-header'
import { CreditCardCarousel } from './_components/credit-card-carousel'

const CardsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cards, showCents] = await Promise.all([
    getCreditCards({ includeArchived: false }),
    getShowCents(),
  ])

  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={
          <Link
            href="/cards/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('actions.add')}
          </Link>
        }
      />

      <CreditCardCarousel cards={cards} showCents={showCents} />
    </div>
  )
}

export default CardsPage
