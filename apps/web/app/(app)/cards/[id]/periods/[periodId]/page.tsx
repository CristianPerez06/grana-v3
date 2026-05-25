import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriodDetail } from '@/lib/cards/queries'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getShowCents } from '@/lib/preferences'
import { PageHeader } from '@/components/ui/page-header'
import { EditDatesSheet } from './_components/edit-dates-sheet'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  params: Promise<{ id: string; periodId: string }>
}

const PeriodDetailPage = async ({ params }: Props) => {
  const { id, periodId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, period, showCents] = await Promise.all([
    getCreditCardDetail(id),
    getCardPeriodDetail(periodId),
    getShowCents(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()
  if (!period) notFound()

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const canEditDates = !period.has_payment
  const totalAmount = period.has_payment ? period.paidAmountARS : period.pendingAmountARS

  const t = await getTranslations('cards')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title={`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`}
        description={`${t('period.due_prefix')} ${formatDate(period.due_date)}`}
        backLink={{ href: `/cards/${id}/periods`, label: t('list.periods_title') }}
        actions={
          canEditDates && (
            <EditDatesSheet
              periodId={period.id}
              currentEndDate={period.end_date}
              currentDueDate={period.due_date}
              nextPeriodStart={period.nextPeriodStart}
              nextPeriodIsPaid={period.nextPeriodIsPaid}
            />
          )
        }
      />

      {/* Amount summary */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
        <p className="text-3xl font-bold">{formatARS(totalAmount, showCents)}</p>
        {hasUSD && (
          <p className="text-sm text-muted-foreground">{formatUSD(period.pendingAmountUSD, showCents)} USD</p>
        )}
        {period.has_payment && period.paymentDate && (
          <p className="text-xs text-green-700 mt-1">
            {t('period.paid_on_prefix')} {formatDate(period.paymentDate)}
          </p>
        )}
      </div>

      {/* Pay CTA */}
      {!period.has_payment && (period.variant === 'cerrado_esperando_pago' || period.variant === 'vencido') && (
        <Link
          href={`/cards/${id}/periods/${periodId}/pay`}
          className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
            period.variant === 'vencido'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {t('actions.pay_statement')}
        </Link>
      )}

      {/* Transactions */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {t('labels.movements_with_count', { count: period.transactions.length })}
        </h2>

        {period.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('period.empty_movements_period')}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {period.transactions.map((tx) => {
              const label = tx.description
                ?? (tx.subcategory?.name ? `${tx.category?.name} · ${tx.subcategory.name}` : tx.category?.name)
                ?? '—'
              return (
              <Link
                key={tx.id}
                href={`/accounts/${id}/transactions/${tx.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {label}
                    {tx.installments_total && tx.installments_total > 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {tx.installment_n}/{tx.installments_total}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">
                    {tx.currency_code === 'ARS'
                      ? formatARS(Number(tx.amount), showCents)
                      : formatUSD(Number(tx.amount), showCents)}
                  </p>
                  {tx.currency_code !== 'ARS' && tx.fx_rate_to_ars && (
                    <p className="text-xs text-muted-foreground">
                      TC {tx.fx_rate_to_ars}
                    </p>
                  )}
                  <span className={`text-xs ${tx.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {tx.status === 'paid' ? t('period.paid') : t('period.pending_short')}
                  </span>
                </div>
              </Link>
            )})}
          </div>
        )}
      </section>
    </div>
  )
}

export default PeriodDetailPage
