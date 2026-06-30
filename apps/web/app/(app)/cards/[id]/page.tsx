import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCreditCardDetail,
  getCardPeriods,
  getActiveInstallments,
  getCardNetworks,
} from '@/lib/cards/queries'
import { getInstitutions } from '@/lib/accounts/queries'
import { classifyPeriodsLifecycle, formatDateISO } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { getShowCents } from '@/lib/preferences'
import { Card } from '@/components/ui/card'
import { CardActions } from './_components/card-actions'
import { CardHeaderActions } from './_components/card-header-actions'
import { EditCardDrawerProvider } from './_components/edit-card-drawer'
import { RegisterFirstPurchaseButton } from './_components/register-first-purchase-button'
import { CardDetailHeader } from '../_components/card-detail-header'
import { CardDetailView } from '../_components/card-detail-view'
import { cardAccent, pillTone, resolveEditCycle } from '@grana/cards'
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

  const [cardDetail, periodsDesc, installments, institutions, networks, showCents, t] =
    await Promise.all([
      getCreditCardDetail(supabase, id),
      getCardPeriods(supabase, id),
      getActiveInstallments(supabase, id),
      getInstitutions(supabase),
      getCardNetworks(supabase),
      getShowCents(),
      getTranslations('cards'),
    ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const today = getTodayAR()
  const todayISO = formatDateISO(today)

  // Back-link to the cards list. Rendered by the page (not the layout) so it
  // doesn't leak into the nested routes (periods, statement detail, edit, pay),
  // each of which renders its own header + back-link.
  const backLink = (
    <Link
      href="/cards"
      className="text-[13px] font-extrabold text-text-muted transition-colors hover:text-foreground"
    >
      {`← ${t('back_label')}`}
    </Link>
  )

  const institutionName =
    cardDetail.other_network_name ??
    (cardDetail.institution as { name?: string } | null)?.name ??
    null

  const accent = cardAccent(
    {
      id: cardDetail.id,
      name: cardDetail.name,
      color_key: cardDetail.color_key,
      icon_key: cardDetail.icon_key,
    },
    cardDetail.institution,
  )

  const cardHasHistory = cardDetail.periods.some((p) => p.has_payment || p.tx_count > 0)

  // ── Edit-drawer data (network is immutable; cycle shown read-only) ──────────
  const network = cardDetail.network_id
    ? networks.find((n) => n.id === cardDetail.network_id) ?? null
    : null
  const networkLabel = network
    ? network.name
    : cardDetail.other_network_name ?? t('labels.network_custom')
  const networkColor = network?.brand_color ?? null

  const editCardData = (committedARS: number) => ({
    cardId: id,
    initialName: cardDetail.name,
    initialInstitutionId: cardDetail.institution_id,
    initialCreditLimit: cardDetail.credit_limit,
    networkLabel,
    networkColor,
    accent,
    committedARS,
    cycle: resolveEditCycle(cardDetail.periods, todayISO),
    institutions,
  })

  // ── Empty state: tarjeta nueva (no history) ─────────────────────────────────
  if (!cardHasHistory && cardDetail.is_active) {
    return (
      <EditCardDrawerProvider card={editCardData(0)}>
        {backLink}
        <CardDetailHeader
          name={cardDetail.name}
          bank={institutionName}
          accent={accent}
          tone="ok"
          // The big "register first purchase" CTA below already covers add.
          actions={<CardHeaderActions cardId={id} showAdd={false} />}
        />
        <Card className="flex flex-col gap-4 p-7">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">{t('detail.ready_title')}</p>
            <p className="text-sm text-text-muted">{t('detail.ready_description')}</p>
          </div>
          <RegisterFirstPurchaseButton cardId={id} />
        </Card>
        <AdminFooter createdAt={cardDetail.created_at} archivedAt={null} />
      </EditCardDrawerProvider>
    )
  }

  // ── Empty state: archived without pendings ──────────────────────────────────
  const hasPendings =
    cardDetail.debtCheck.hasPendingDebt ||
    cardDetail.periods.some((p) => !p.has_payment && p.tx_count > 0)

  if (!cardDetail.is_active && !hasPendings) {
    return (
      <>
        {backLink}
        <CardDetailHeader name={cardDetail.name} bank={institutionName} accent={accent} tone="ok" />
        <CardActions cardId={id} isActive={false} hasMovements={cardHasHistory} />
        <p className="py-6 text-center text-sm text-text-muted">{t('detail.archived_no_pending')}</p>
        <CardDetailsSection createdAt={cardDetail.created_at} archivedAt={cardDetail.created_at} />
      </>
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

  const sideExtras = (
    <div className="flex flex-col gap-4">
      <div className="border-t border-border pt-4">
        <Link
          href={`/cards/${id}/periods`}
          className="text-sm font-semibold text-text-muted transition-colors hover:text-text"
        >
          {t('actions.view_all_periods')}
        </Link>
      </div>
      <AdminFooter
        createdAt={cardDetail.created_at}
        archivedAt={cardDetail.is_active ? null : cardDetail.created_at}
      />
    </div>
  )

  return (
    <EditCardDrawerProvider card={editCardData(committedARS)}>
      {backLink}
      <CardDetailHeader
        name={cardDetail.name}
        bank={institutionName}
        accent={accent}
        tone={headerTone}
        actions={cardDetail.is_active ? <CardHeaderActions cardId={id} hasMovements={cardHasHistory} /> : undefined}
      />

      {!cardDetail.is_active && <CardActions cardId={id} isActive={false} hasMovements={cardHasHistory} />}

      <CardDetailView vm={vm} todayISO={todayISO} showCents={showCents} sideExtras={sideExtras} />
    </EditCardDrawerProvider>
  )
}

// Edit moved to the header (pencil icon); the footer keeps only the metadata.
const AdminFooter = ({
  createdAt,
  archivedAt,
}: {
  createdAt: string
  archivedAt: string | null
}) => (
  <div className="flex flex-col gap-3 border-t border-border pt-4">
    <CardDetailsSection createdAt={createdAt} archivedAt={archivedAt} />
  </div>
)

export default CardDetailPage
