import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardPeriods } from '@/lib/cards/queries'
import { addDaysToISO, formatDateISO, suggestNextPeriodDates, sumMoneyValues } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getShowCents } from '@/lib/preferences'
import { CardHero } from '../_components/card-hero'
import { PaymentCTABlock } from '../_components/payment-cta-block'
import { PeriodAlertBanner } from '../_components/period-alert-banner'
import { CardsThermometer, type ThermometerColumn } from '../_components/cards-thermometer'
import { LimitSummary } from '../_components/limit-summary'
import { CardDetailsSection } from '../_components/card-details-section'
import { CardActions } from './_components/card-actions'
import type { CardPeriodDetail } from '@/lib/cards/queries'
import type { PeriodVariant } from '@/lib/cards/types'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const activeColumnLabel = (variant: PeriodVariant): {
  label: ThermometerColumn['label']
  tone: ThermometerColumn['tone']
} => {
  switch (variant) {
    case 'cerrado_esperando_pago':
      return { label: 'POR PAGAR', tone: 'amber' }
    case 'vencido':
      return { label: 'VENCIDO', tone: 'red' }
    case 'pagado':
      return { label: 'PAGADO', tone: 'paid' }
    case 'actual':
    case 'futuro':
    case 'tarjeta_nueva':
    default:
      return { label: 'EN CURSO', tone: 'neutral' }
  }
}

type Props = {
  params: Promise<{ id: string }>
}

const CardDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, periodsDesc, showCents] = await Promise.all([
    getCreditCardDetail(id),
    getCardPeriods(id),
    getShowCents(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const today = getTodayAR()
  const todayStr = formatDateISO(today)

  // Empty state: tarjeta_nueva — no movement and no payment in any period.
  const cardHasHistory = cardDetail.periods.some((p) => p.has_payment || p.tx_count > 0)

  const institutionName =
    cardDetail.other_network_name ??
    (cardDetail.institution as { name?: string } | null)?.name ??
    null

  // ── Empty state: tarjeta nueva (no history) ─────────────────────────────────
  if (!cardHasHistory && cardDetail.is_active) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <Breadcrumb />
        <CardHero
          name={cardDetail.name}
          institutionName={institutionName}
          creditLimit={cardDetail.credit_limit}
          showCents={showCents}
        />

        <div className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Tu tarjeta está lista.</p>
            <p className="text-sm text-muted-foreground">
              Registrá el primer consumo para empezar a ver cómo viene cada resumen.
            </p>
          </div>
          <Link
            href={`/accounts/${id}/transactions/new`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Registrar primer consumo
          </Link>
        </div>

        <AdminFooter
          cardId={id}
          isActive={cardDetail.is_active}
          hasMovements={false}
          createdAt={cardDetail.created_at}
          archivedAt={null}
        />
      </div>
    )
  }

  // ── Empty state: tarjeta archivada ──────────────────────────────────────────
  // Por la regla de archivado (no se archiva con deuda), una tarjeta inactiva
  // nunca tiene consumos pendientes: siempre es el estado "sin pendientes".
  if (!cardDetail.is_active) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <Breadcrumb />
        <CardHero
          name={cardDetail.name}
          institutionName={institutionName}
          creditLimit={cardDetail.credit_limit}
          showCents={showCents}
        />

        <CardActions cardId={id} isActive={false} hasMovements={cardHasHistory} />

        <p className="text-sm text-muted-foreground text-center py-6">
          Tarjeta archivada · sin pendientes
        </p>

        <CardDetailsSection
          createdAt={cardDetail.created_at}
          archivedAt={cardDetail.created_at}
        />
      </div>
    )
  }

  // ── Active period detection (same precedence as listado de tarjetas) ────────
  const periodsAsc = [...periodsDesc].reverse()
  const unpaidAsc = periodsAsc.filter((p) => !p.has_payment)

  const activePeriod =
    unpaidAsc.find((p) => p.due_date < todayStr && p.tx_count > 0) ??
    unpaidAsc.find((p) => p.end_date < todayStr && p.due_date >= todayStr && p.tx_count > 0) ??
    unpaidAsc.find((p) => p.start_date <= todayStr && todayStr <= p.end_date) ??
    unpaidAsc.at(-1) ??
    periodsAsc.at(-1)!

  // ── Next 2 periods after the active one (chronological order) ───────────────
  const activeIdx = periodsAsc.findIndex((p) => p.id === activePeriod.id)
  const realAfter = periodsAsc.slice(activeIdx + 1, activeIdx + 3)
  const projectedNeeded = 2 - realAfter.length

  const projectedAfter: Array<{
    start_date: string
    end_date: string
    due_date: string
    pendingAmountARS: number
    pendingAmountUSD: number
  }> = []
  if (projectedNeeded > 0) {
    const working = periodsAsc.map((p) => ({
      start_date: p.start_date,
      end_date: p.end_date,
      due_date: p.due_date,
    }))
    if (realAfter.length > 0) {
      // We already have one real next; project from the last real period.
    }
    for (let i = 0; i < projectedNeeded; i++) {
      const last = working[working.length - 1]
      const { suggestedEndDate, suggestedDueDate } = suggestNextPeriodDates(working, today)
      const start = addDaysToISO(last.end_date, 1)
      const projected = {
        start_date: start,
        end_date: suggestedEndDate,
        due_date: suggestedDueDate,
      }
      working.push(projected)
      projectedAfter.push({ ...projected, pendingAmountARS: 0, pendingAmountUSD: 0 })
    }
  }

  const nextPeriods = [...realAfter, ...projectedAfter]
  const nextCol = nextPeriods[0]
  const siguienteCol = nextPeriods[1]

  // ── Build thermometer columns ───────────────────────────────────────────────
  const activeLabel = cardDetail.is_active
    ? activeColumnLabel(activePeriod.variant)
    : activeColumnLabel(activePeriod.variant) // archived shows real state too

  const columns: [ThermometerColumn, ThermometerColumn, ThermometerColumn] = [
    {
      label: activeLabel.label,
      tone: activeLabel.tone,
      closeDate: activePeriod.end_date,
      dueDate: activePeriod.due_date,
      pendingARS: activePeriod.pendingAmountARS,
      pendingUSD: activePeriod.pendingAmountUSD,
    },
    {
      label: 'PRÓXIMO',
      tone: 'neutral',
      closeDate: nextCol.end_date,
      dueDate: nextCol.due_date,
      pendingARS: nextCol.pendingAmountARS,
      pendingUSD: nextCol.pendingAmountUSD,
    },
    {
      label: 'SIGUIENTE',
      tone: 'neutral',
      closeDate: siguienteCol.end_date,
      dueDate: siguienteCol.due_date,
      pendingARS: siguienteCol.pendingAmountARS,
      pendingUSD: siguienteCol.pendingAmountUSD,
    },
  ]

  const totalCommittedARS = sumMoneyValues(columns.map((c) => c.pendingARS))

  // ── CTA variant for active period ──────────────────────────────────────────
  const ctaVariant: PeriodVariant | 'inactiva' = !cardDetail.is_active
    ? 'inactiva'
    : activePeriod.variant

  // ── Transactions of the active period (already in periodsDesc) ─────────────
  const activeWithTxs = periodsDesc.find((p) => p.id === activePeriod.id)
  const txList: CardPeriodDetail['transactions'] = activeWithTxs?.transactions ?? []

  const needsPayment =
    cardDetail.is_active &&
    (activePeriod.variant === 'vencido' || activePeriod.variant === 'cerrado_esperando_pago')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Breadcrumb />

      <CardHero
        name={cardDetail.name}
        institutionName={institutionName}
        creditLimit={cardDetail.credit_limit}
        showCents={showCents}
      />

      {needsPayment && (
        <PeriodAlertBanner
          cardId={id}
          periodId={activePeriod.id}
          variant={activePeriod.variant as 'vencido' | 'cerrado_esperando_pago'}
          dueDate={activePeriod.due_date}
        />
      )}

      <CardsThermometer
        columns={columns}
        creditLimit={cardDetail.credit_limit}
        showCents={showCents}
      />

      <LimitSummary
        creditLimit={cardDetail.credit_limit}
        totalCommittedARS={totalCommittedARS}
        editHref={`/cards/${id}/edit`}
        showCents={showCents}
      />

      <PaymentCTABlock
        cardId={id}
        variant={ctaVariant}
        canRegisterPurchase={cardDetail.is_active}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Movimientos del resumen actual
          </h2>
          <Link
            href={`/cards/${id}/periods`}
            className="text-xs text-primary hover:underline"
          >
            Ver todos los resúmenes →
          </Link>
        </div>

        {txList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin movimientos en este resumen.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {txList.map((tx) => {
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
                    <p className="text-sm font-medium tabular-nums">
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

      <AdminFooter
        cardId={id}
        isActive={cardDetail.is_active}
        hasMovements={cardHasHistory}
        createdAt={cardDetail.created_at}
        archivedAt={cardDetail.is_active ? null : cardDetail.created_at}
      />
    </div>
  )
}

const Breadcrumb = () => (
  <div className="flex items-center gap-3">
    <Link
      href="/cards"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      ← Tarjetas
    </Link>
  </div>
)

const AdminFooter = ({
  cardId,
  isActive,
  hasMovements,
  createdAt,
  archivedAt,
}: {
  cardId: string
  isActive: boolean
  hasMovements: boolean
  createdAt: string
  archivedAt: string | null
}) => (
  <div className="flex flex-col gap-3 pt-4 border-t border-border">
    <CardDetailsSection createdAt={createdAt} archivedAt={archivedAt} />
    {isActive && (
      <CardActions cardId={cardId} isActive={isActive} hasMovements={hasMovements} />
    )}
  </div>
)

export default CardDetailPage
