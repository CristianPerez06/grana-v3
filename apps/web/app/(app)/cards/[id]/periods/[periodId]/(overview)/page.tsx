import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriodDetail } from '@/lib/cards/queries'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getShowCents } from '@/lib/preferences'
import { getTodayAR, formatDateISO } from '@/lib/date'
import { translateCategoryLabel, translateSubcategoryLabel } from '@/lib/categories/display'
import { EditDatesSheet } from '../_components/edit-dates-sheet'
import { RevertPaymentAction } from '../_components/revert-payment-action'

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
    getCreditCardDetail(supabase, id),
    getCardPeriodDetail(supabase, periodId),
    getShowCents(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()
  if (!period) notFound()

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const totalAmount = period.has_payment ? period.paidAmountARS : period.pendingAmountARS

  const [t, tTx, tRoot] = await Promise.all([
    getTranslations('cards'),
    getTranslations('transactions'),
    getTranslations(),
  ])

  const canEditDates = !period.has_payment

  // Agrupado por fecha (Hoy / Ayer / día) igual que el listado canónico de
  // movimientos (MovementList). period.transactions ya viene ordenado desc por date.
  const todayISO = formatDateISO(getTodayAR())
  const yesterdayISO = (() => {
    const [y, m, d] = todayISO.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${dt.getFullYear()}-${mm}-${dd}`
  })()
  const formatGroupDate = (dateStr: string): string => {
    if (dateStr === todayISO) return tTx('list.today')
    if (dateStr === yesterdayISO) return tTx('list.yesterday')
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }
  const txGroups = (() => {
    const groups = new Map<string, typeof period.transactions>()
    for (const tx of period.transactions) {
      const existing = groups.get(tx.date) ?? []
      existing.push(tx)
      groups.set(tx.date, existing)
    }
    return Array.from(groups.entries())
  })()

  return (
    <>
      {/* Date range + edit-dates action — dynamic chrome sub-header. The
          layout chrome is sync (back-link + generic title); this is the
          per-period detail that depends on data. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold">
            {`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {`${t('period.due_prefix')} ${formatDate(period.due_date)}`}
          </p>
        </div>
        {canEditDates && (
          <EditDatesSheet
            periodId={period.id}
            currentEndDate={period.end_date}
            currentDueDate={period.due_date}
            nextPeriodStart={period.nextPeriodStart}
            nextPeriodIsPaid={period.nextPeriodIsPaid}
          />
        )}
      </div>

      {/* Amount summary — paid periods show what WAS paid, per currency. */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
        <p className="text-3xl font-bold">{formatARS(totalAmount, showCents)}</p>
        {hasUSD && (
          <p className="text-sm text-muted-foreground">
            {formatUSD(
              period.has_payment ? period.paidAmountUSD : period.pendingAmountUSD,
              showCents,
            )}{' '}
            USD
          </p>
        )}
        {period.has_payment && period.paymentDate && (
          <p className="text-xs text-green-700 mt-1">
            {t('period.paid_on_prefix')} {formatDate(period.paymentDate)}
          </p>
        )}
        {period.has_payment && (
          <div className="mt-3 flex flex-col gap-2">
            <RevertPaymentAction
              periodId={period.id}
              paymentAmount={period.paymentAmount ?? 0}
              paymentAccountName={period.paymentAccountName}
              // Los movimientos que vuelven a pendiente son los `paid` del resumen; si
              // el pago registró un sello, ese se elimina y se enuncia aparte.
              movementCount={
                period.transactions.filter((tx) => tx.status === 'paid').length -
                (period.paymentHasStampTax ? 1 : 0)
              }
              hasStampTax={period.paymentHasStampTax}
              showCents={showCents}
            />
          </div>
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
          <div className="flex flex-col rounded-lg border border-border">
            {txGroups.map(([groupDate, groupTxs], groupIndex) => (
              <section
                key={groupDate}
                className={groupIndex === 0 ? '' : 'border-t border-border pt-3 mt-1'}
              >
                <p className="px-4 pb-2 pt-3 text-[12px] font-extrabold capitalize text-muted-foreground">
                  {formatGroupDate(groupDate)}
                </p>
                <div className="flex flex-col divide-y divide-border">
                  {groupTxs.map((tx) => {
                    const isReimbursement = tx.type === 'reimbursement'
                    const categoryLabel = tx.category
                      ? translateCategoryLabel(
                          tx.category.name,
                          tx.category.canonical_name,
                          tx.category.user_id === null,
                          tRoot,
                        )
                      : null
                    const subcategoryLabel = tx.subcategory
                      ? translateSubcategoryLabel(
                          tx.subcategory.name,
                          tx.subcategory.canonical_name,
                          tx.subcategory.user_id === null,
                          tRoot,
                        )
                      : null
                    const taxonomy = subcategoryLabel
                      ? `${categoryLabel} · ${subcategoryLabel}`
                      : categoryLabel
                    const label =
                      tx.description ?? taxonomy ?? (isReimbursement ? tTx('reimbursement.label') : '—')
                    // Si el título ya es la taxonomía (sin descripción), no la repetimos abajo.
                    const subtitle = tx.description ? taxonomy : null
                    return (
                      <Link
                        key={tx.id}
                        href={`/transactions/${tx.id}?from=card:${id}`}
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
                          {subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-medium ${isReimbursement ? 'text-green-600' : ''}`}>
                            {isReimbursement ? '−' : ''}
                            {tx.currency_code === 'ARS'
                              ? formatARS(Number(tx.amount), showCents)
                              : formatUSD(Number(tx.amount), showCents)}
                          </p>
                          {tx.currency_code !== 'ARS' && tx.fx_rate_to_ars && (
                            <p className="text-xs text-muted-foreground">TC {tx.fx_rate_to_ars}</p>
                          )}
                          {!isReimbursement && (
                            <span className={`text-xs ${tx.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {tx.status === 'paid' ? t('period.paid') : t('period.pending_short')}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default PeriodDetailPage
