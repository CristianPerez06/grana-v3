import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriodDetail } from '@/lib/cards/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { suggestNextPeriodDates } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { PageHeader } from '@/components/ui/page-header'
import { PayCardPeriodForm } from './_components/pay-card-period-form'
import { USDSubordinatedNote } from './_components/usd-subordinated-note'

type Props = {
  params: Promise<{ id: string; periodId: string }>
}

const PayPeriodPage = async ({ params }: Props) => {
  const { id, periodId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, period, accountGroups] = await Promise.all([
    getCreditCardDetail(id),
    getCardPeriodDetail(periodId),
    getAccounts(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()
  if (!period) notFound()

  // Only allow paying closed/overdue periods
  if (period.variant !== 'cerrado_esperando_pago' && period.variant !== 'vencido') {
    redirect(`/cards/${id}/periods/${periodId}`)
  }

  const today = getTodayAR()
  const { suggestedEndDate, suggestedDueDate } = suggestNextPeriodDates(
    cardDetail.periods,
    today,
  )

  // Payment accounts: cash + bank with ARS active
  const paymentAccounts = [
    ...accountGroups.cash,
    ...accountGroups.bank,
  ]
    .filter((a) => a.is_active && a.currencies.some((c) => c.currency_code === 'ARS' && c.is_active))
    .map((a) => ({ id: a.id, name: a.name, balanceARS: a.balances.ARS }))

  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('payment.title')}
        backLink={{ href: `/cards/${id}/periods/${periodId}`, label: t('payment.back_label') }}
      />

      {period.pendingAmountUSD > 0 && (
        <USDSubordinatedNote usdAmount={period.pendingAmountUSD} />
      )}

      <PayCardPeriodForm
        periodId={periodId}
        cardId={id}
        pendingAmountARS={period.pendingAmountARS}
        suggestedNextEndDate={suggestedEndDate}
        suggestedNextDueDate={suggestedDueDate}
        paymentAccounts={paymentAccounts}
      />
    </div>
  )
}

export default PayPeriodPage
