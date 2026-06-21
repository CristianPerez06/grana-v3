import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriods } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { PageHeader } from '@/components/ui/page-header'
import { PeriodsList } from './_components/periods-list'

type Props = {
  params: Promise<{ id: string }>
}

const CardPeriodsPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, periods, showCents, t] = await Promise.all([
    getCreditCardDetail(supabase, id),
    getCardPeriods(supabase, id),
    getShowCents(),
    getTranslations('cards'),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  // Header lives in the page (not a layout) so the "Resúmenes" title + back-link
  // don't leak into the statement detail / pay routes nested under this segment.
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title={t('list.periods_title')}
        backLink={{ href: `/cards/${id}`, label: t('back_label') }}
      />
      <PeriodsList periods={periods} cardId={id} hasUSD={hasUSD} showCents={showCents} />
    </div>
  )
}

export default CardPeriodsPage
