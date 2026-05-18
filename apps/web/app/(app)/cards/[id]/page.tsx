import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriods, getCardPeriodDetail } from '@/lib/cards/queries'
import { derivePeriodVariant } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { formatARS, formatUSD } from '@/lib/format'
import { getShowCents } from '@/lib/preferences'
import { CardHero } from '../_components/card-hero'
import { PaymentCTABlock } from '../_components/payment-cta-block'
import { QuickActions } from '../_components/quick-actions'
import { CardDetailsSection } from '../_components/card-details-section'
import { CardActions } from './_components/card-actions'
import type { CreditCardSummary, CardPeriodDetail } from '@/lib/cards/queries'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  params: Promise<{ id: string }>
}

const CardDetailPage = async ({ params }: Props) => {
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

  const today = getTodayAR()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Active period priority:
  // 1. Overdue with debt (past due_date, unpaid, has transactions)
  // 2. Closed waiting for payment (past end_date but before due_date, has transactions)
  // 3. Current open period (today within range)
  // 4. Fallback: latest unpaid
  const unpaidPeriods = cardDetail.periods.filter((p) => !p.has_payment)
  const activePeriod =
    unpaidPeriods.find((p) => p.due_date < todayStr && p.tx_count > 0) ??
    unpaidPeriods.find((p) => p.end_date < todayStr && p.due_date >= todayStr && p.tx_count > 0) ??
    unpaidPeriods.find((p) => p.start_date <= todayStr && todayStr <= p.end_date) ??
    unpaidPeriods.at(-1) ??
    null

  const activePeriodForDetail = periods.find((p) => p.id === activePeriod?.id) ?? null

  // Load transactions of the active period
  const activePeriodDetail = activePeriod ? await getCardPeriodDetail(activePeriod.id) : null

  const activePeriodMeta = activePeriodForDetail
    ? ({
        ...activePeriodForDetail,
        pendingAmountARS: activePeriodForDetail.pendingAmountARS,
        pendingAmountUSD: activePeriodForDetail.pendingAmountUSD,
        variant: activePeriodForDetail.variant,
        alert: activePeriodForDetail.alert,
      } as CreditCardSummary['activePeriod'])
    : null

  const cardForHero = {
    name: cardDetail.name,
    is_active: cardDetail.is_active,
    institution: cardDetail.institution as { name: string } | null,
    other_network_name: cardDetail.other_network_name,
    currencies: cardDetail.currencies,
    activePeriod: activePeriodMeta,
  }

  // A card is truly "nueva" only if no period has ever had a transaction or payment.
  // After the first payment, empty open periods are just normal open periods.
  const cardHasHistory = cardDetail.periods.some((p) => p.has_payment || p.tx_count > 0)
  const rawVariant = activePeriodForDetail?.variant ?? 'tarjeta_nueva'
  const ctaVariant = !cardDetail.is_active
    ? 'inactiva'
    : cardHasHistory && rawVariant === 'tarjeta_nueva'
      ? 'actual'
      : rawVariant

  const hasUSD = cardDetail.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const txList: CardPeriodDetail['transactions'] = activePeriodDetail?.transactions ?? []

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/cards"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Tarjetas
        </Link>
      </div>

      <CardHero card={cardForHero} showCents={showCents} />

      <CardActions cardId={id} isActive={cardDetail.is_active} />

      {cardDetail.is_active && (
        <>
          <PaymentCTABlock
            cardId={id}
            periodId={activePeriodForDetail?.id ?? null}
            variant={ctaVariant}
          />

          {ctaVariant !== 'tarjeta_nueva' && <QuickActions cardId={id} />}
        </>
      )}

      {/* Transactions of the active period */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Movimientos
            {activePeriodDetail && (
              <span className="ml-1.5 font-normal normal-case">
                — {formatDate(activePeriodDetail.start_date)} al {formatDate(activePeriodDetail.end_date)}
              </span>
            )}
          </h2>
          <Link
            href={`/cards/${id}/periods`}
            className="text-xs text-primary hover:underline"
          >
            Ver resúmenes
          </Link>
        </div>

        {txList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin movimientos en este resumen.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {txList.map((tx: CardPeriodDetail['transactions'][number]) => {
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
                      <p className="text-xs text-muted-foreground">TC {tx.fx_rate_to_ars}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Upcoming periods (non-active, unpaid) */}
      {(() => {
        const upcomingPeriods = periods.filter(
          (p) => !p.has_payment && p.id !== activePeriod?.id,
        )
        if (upcomingPeriods.length === 0) return null
        return (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Próximos resúmenes
              </h2>
              <Link href={`/cards/${id}/periods`} className="text-xs text-primary hover:underline">
                Ver historial
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {upcomingPeriods.slice(0, 2).map((p) => (
                <Link
                  key={p.id}
                  href={`/cards/${id}/periods/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(p.start_date)} – {formatDate(p.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">Vence {formatDate(p.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatARS(p.pendingAmountARS, showCents)}</p>
                    {hasUSD && p.pendingAmountUSD > 0 && (
                      <p className="text-xs text-muted-foreground">{formatUSD(p.pendingAmountUSD, showCents)} USD</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })()}

      <CardDetailsSection
        creditLimit={cardDetail.credit_limit}
        pendingAmountARS={activePeriodForDetail?.pendingAmountARS ?? 0}
        createdAt={cardDetail.created_at}
        archivedAt={cardDetail.is_active ? null : cardDetail.created_at}
        showCents={showCents}
      />
    </div>
  )
}

export default CardDetailPage
