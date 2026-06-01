import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCreditCardDetail,
  getCardPeriods,
  getActiveInstallments,
} from '@/lib/cards/queries'
import { classifyPeriodsLifecycle, formatDateISO } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { getShowCents } from '@/lib/preferences'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardActions } from './_components/card-actions'
import { CardDetailHeader } from '../_components/card-detail-header'
import { CardDetailView } from '../_components/card-detail-view'
import { cardAccent, pillTone } from '../_components/card-presentation'
import { CardDetailsSection } from '../_components/card-details-section'
import type { CardDetailViewModel } from '../_components/card-detail-types'
import type { CardPeriodDetail } from '@/lib/cards/queries'

const daysBetweenISO = (fromISO: string, toISO: string): number => {
  const [ay, am, ad] = fromISO.split('-').map(Number)
  const [by, bm, bd] = toISO.split('-').map(Number)
  const a = new Date(ay, am - 1, ad).getTime()
  const b = new Date(by, bm - 1, bd).getTime()
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

/** Installments (ARS) imputed to a period = pending children with installment_n. */
const installmentsARSOf = (period: CardPeriodDetail): number =>
  period.transactions
    .filter((tx) => tx.installments_total && tx.installments_total > 1 && tx.currency_code === 'ARS')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)

type Props = {
  params: Promise<{ id: string }>
}

const CardDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, periodsDesc, installments, showCents, t] = await Promise.all([
    getCreditCardDetail(id),
    getCardPeriods(id),
    getActiveInstallments(id),
    getShowCents(),
    getTranslations('cards'),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const today = getTodayAR()
  const todayISO = formatDateISO(today)

  const institutionName =
    cardDetail.other_network_name ??
    (cardDetail.institution as { name?: string } | null)?.name ??
    null

  const accent = cardAccent({
    id: cardDetail.id,
    name: cardDetail.name,
    color_key: cardDetail.color_key,
    icon_key: cardDetail.icon_key,
  })

  const cardHasHistory = cardDetail.periods.some((p) => p.has_payment || p.tx_count > 0)

  // ── Empty state: tarjeta nueva (no history) ─────────────────────────────────
  if (!cardHasHistory && cardDetail.is_active) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Breadcrumb label={t('back_label')} />
        <CardDetailHeader name={cardDetail.name} bank={institutionName} accent={accent} tone="ok" />
        <Card className="flex flex-col gap-4 p-7">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">{t('detail.ready_title')}</p>
            <p className="text-sm text-text-muted">{t('detail.ready_description')}</p>
          </div>
          <Button asChild size="lg">
            <Link href={`/transactions/new?account=${id}&from=card:${id}`}>
              {t('actions.register_first_purchase')}
            </Link>
          </Button>
        </Card>
        <AdminFooter cardId={id} isActive hasMovements={false} createdAt={cardDetail.created_at} archivedAt={null} />
      </div>
    )
  }

  // ── Empty state: archived without pendings ──────────────────────────────────
  const hasPendings =
    cardDetail.debtCheck.hasPendingDebt ||
    cardDetail.periods.some((p) => !p.has_payment && p.tx_count > 0)

  if (!cardDetail.is_active && !hasPendings) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Breadcrumb label={t('back_label')} />
        <CardDetailHeader name={cardDetail.name} bank={institutionName} accent={accent} tone="ok" />
        <CardActions cardId={id} isActive={false} hasMovements={cardHasHistory} />
        <p className="py-6 text-center text-sm text-text-muted">{t('detail.archived_no_pending')}</p>
        <CardDetailsSection createdAt={cardDetail.created_at} archivedAt={cardDetail.created_at} />
      </div>
    )
  }

  // ── Classify the lifecycle (apagar / curso / prox) ──────────────────────────
  const lifecycle = classifyPeriodsLifecycle(cardDetail.periods, today)
  const byId = new Map(periodsDesc.map((p) => [p.id, p]))

  // Resolve each lifecycle period to its full detail (with transactions).
  const apagar = lifecycle.apagar ? byId.get(lifecycle.apagar.id) ?? null : null
  const curso = lifecycle.curso ? byId.get(lifecycle.curso.id) ?? null : null
  const prox = lifecycle.prox ? byId.get(lifecycle.prox.id) ?? null : null

  // Curso is the anchor; if classification couldn't find one (degenerate data),
  // fall back to the latest unpaid period detail.
  const cursoPeriod = curso ?? periodsDesc.find((p) => !p.has_payment) ?? periodsDesc[0]
  if (!cursoPeriod) notFound()

  const cursoCycleTotal = Math.max(1, daysBetweenISO(cursoPeriod.start_date, cursoPeriod.end_date))
  const cursoCycleDayRaw = daysBetweenISO(cursoPeriod.start_date, todayISO)
  const cursoCycleDay = Math.max(0, Math.min(cursoCycleTotal, cursoCycleDayRaw))
  const cursoDaysToClose = Math.max(0, daysBetweenISO(todayISO, cursoPeriod.end_date))

  const apagarDaysToDue = apagar ? daysBetweenISO(todayISO, apagar.due_date) : null

  const committedARS = [apagar, cursoPeriod, prox]
    .filter((p): p is CardPeriodDetail => p !== null)
    .reduce((sum, p) => sum + p.pendingAmountARS, 0)

  const hasUSD = cardDetail.currencies.some(
    (c) => c.currency_code === 'USD' && c.is_active,
  )

  const vm: CardDetailViewModel = {
    cardId: id,
    accent,
    creditLimit: cardDetail.credit_limit,
    committedARS,
    hasUSD,
    hasPaid: cardDetail.periods.some((p) => p.has_payment),
    apagar,
    curso: cursoPeriod,
    prox,
    cursoCycleDay,
    cursoCycleTotal,
    cursoInstallmentsARS: installmentsARSOf(cursoPeriod),
    cursoDaysToClose,
    apagarDaysToDue,
    installments: installments.items,
    installmentsTotalRemaining: installments.totalRemaining,
  }

  const headerTone = pillTone(
    apagar?.alert ?? cursoPeriod.alert,
    apagar?.variant ?? cursoPeriod.variant,
  )

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Breadcrumb label={t('back_label')} />
      <CardDetailHeader name={cardDetail.name} bank={institutionName} accent={accent} tone={headerTone} />

      {!cardDetail.is_active && <CardActions cardId={id} isActive={false} hasMovements={cardHasHistory} />}

      <CardDetailView vm={vm} todayISO={todayISO} showCents={showCents} />

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <Link href={`/cards/${id}/periods`} className="text-sm font-semibold text-text-muted transition-colors hover:text-text">
          {t('actions.view_all_periods')}
        </Link>
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

const Breadcrumb = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <Link href="/cards" className="text-sm text-text-muted transition-colors hover:text-text">
      ‹ {label}
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
  <div className="flex flex-col gap-3 border-t border-border pt-4">
    <CardDetailsSection createdAt={createdAt} archivedAt={archivedAt} />
    {isActive && <CardActions cardId={cardId} isActive={isActive} hasMovements={hasMovements} />}
  </div>
)

export default CardDetailPage
