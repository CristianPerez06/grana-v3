import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
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
    getCreditCardDetail(id),
    getCardPeriods(id),
    getShowCents(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/cards/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {cardDetail.name}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Resúmenes</h1>

      <PeriodsList periods={periods} cardId={id} hasUSD={hasUSD} showCents={showCents} />
    </div>
  )
}

export default CardPeriodsPage
