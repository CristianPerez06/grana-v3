import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriodDetail } from '@/lib/cards/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { suggestNextPeriodDates } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
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
    getCreditCardDetail(supabase, id),
    getCardPeriodDetail(supabase, periodId),
    getAccounts(supabase),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()
  if (!period) notFound()

  // Only allow paying closed/overdue periods
  if (period.variant !== 'cerrado_esperando_pago' && period.variant !== 'vencido') {
    redirect(`/cards/${id}/periods/${periodId}`)
  }

  const today = getTodayAR()

  // The statement being paid announces the dates of the cycle now running —
  // P(n+1), the first period after the one being paid. The form pre-fills its
  // persisted (usually estimated) dates so the user confirms them against the
  // statement in hand. Legacy cards without that row fall back to a projection.
  const runningPeriod =
    cardDetail.periods.find((p) => p.start_date > period.start_date) ?? null
  const projection = suggestNextPeriodDates(cardDetail.periods, today)
  const runningEndDate = runningPeriod?.end_date ?? projection.suggestedEndDate
  const runningDueDate = runningPeriod?.due_date ?? projection.suggestedDueDate
  const runningIsEstimated = runningPeriod?.is_estimated ?? true

  // Payment accounts: cash + bank with ARS active
  const paymentAccounts = [
    ...accountGroups.cash,
    ...accountGroups.bank,
  ]
    .filter((a) => a.is_active && a.currencies.some((c) => c.currency_code === 'ARS' && c.is_active))
    .map((a) => ({ id: a.id, name: a.name, balanceARS: a.balances.ARS }))

  return (
    <>
      {period.pendingAmountUSD > 0 && (
        <USDSubordinatedNote usdAmount={period.pendingAmountUSD} />
      )}

      <PayCardPeriodForm
        periodId={periodId}
        cardId={id}
        pendingAmountARS={period.pendingAmountARS}
        pendingAmountUSD={period.pendingAmountUSD}
        runningEndDate={runningEndDate}
        runningDueDate={runningDueDate}
        runningIsEstimated={runningIsEstimated}
        paidPeriodEndDate={period.end_date}
        paymentAccounts={paymentAccounts}
      />
    </>
  )
}

export default PayPeriodPage
