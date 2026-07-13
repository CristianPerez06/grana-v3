import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriodDetail } from '@/lib/cards/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { suggestNextPeriodDates } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { cardAccent, cardMonogram, formatDayMonth } from '@grana/cards'
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
    .map((a) => ({
      id: a.id,
      name: a.name,
      // Secondary line: the issuing institution when it differs from the name
      // (matches the accounts listing's name / institution split).
      subtitle: a.institution && a.institution.name !== a.name ? a.institution.name : null,
      balanceARS: a.balances.ARS,
      avatar: a.avatar,
    }))

  const t = await getTranslations('cards')
  const accent = cardAccent(cardDetail, cardDetail.institution)
  const monogram = cardMonogram(cardDetail.name)

  return (
    <>
      {/* Rich header: card identity (mark) + statement context, per the handoff. */}
      <header className="flex flex-col gap-3">
        <Link
          href={`/cards/${id}/periods/${periodId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t('payment.back_label')}
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-[12px] text-base font-extrabold text-white"
            style={{ backgroundColor: accent }}
            aria-hidden
          >
            {monogram}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{t('payment.title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('payment.header_context', {
            card: cardDetail.name,
            close: formatDayMonth(period.end_date),
            due: formatDayMonth(period.due_date),
          })}
        </p>
      </header>

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
        stampTaxRate={period.stampTaxRate}
        paymentAccounts={paymentAccounts}
      />
    </>
  )
}

export default PayPeriodPage
