import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriods } from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { PeriodsList } from './_components/periods-list'

type Props = {
  params: Promise<{ id: string }>
}

const CardPeriodsPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, periods, showCents] = await Promise.all([
    getCreditCardDetail(supabase, id),
    getCardPeriods(supabase, id),
    getShowCents(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  return <PeriodsList periods={periods} cardId={id} hasUSD={hasUSD} showCents={showCents} />
}

export default CardPeriodsPage
