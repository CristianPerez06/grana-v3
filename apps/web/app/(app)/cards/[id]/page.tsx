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
import { formatDateISO } from '@/lib/cards/utils'
import { getTodayAR } from '@/lib/date'
import { getShowCents } from '@/lib/preferences'
import { Card } from '@/components/ui/card'
import { CardActions } from './_components/card-actions'
import { CardHeaderActions } from './_components/card-header-actions'
import { EditCardDrawerProvider } from './_components/edit-card-drawer'
import { RegisterFirstPurchaseButton } from './_components/register-first-purchase-button'
import { CardDetailHeader } from '../_components/card-detail-header'
import { CardDetailView } from '../_components/card-detail-view'
import { resolveCardDetailState } from '@grana/cards'
import { CardDetailsSection } from '../_components/card-details-section'

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

  const todayISO = formatDateISO(getTodayAR())

  // Pure view-model + screen-state derivation (lifecycle, cycle counters,
  // committed total, empty-state branching) lives in `@grana/cards` so mobile
  // can reuse it. The page only fetches, maps the state to JSX, and assembles
  // the platform-coupled glue (edit drawer + i18n network label).
  const state = resolveCardDetailState({
    cardDetail,
    periods: periodsDesc,
    installments,
    todayISO,
  })

  if (state.kind === 'not-found') notFound()

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
    accent: state.shared.accent,
    committedARS,
    cycle: state.shared.editCycle,
    institutions,
  })

  // ── Empty state: tarjeta nueva (no history) ─────────────────────────────────
  if (state.kind === 'new-card') {
    return (
      <EditCardDrawerProvider card={editCardData(0)}>
        {backLink}
        <CardDetailHeader
          name={cardDetail.name}
          bank={state.shared.institutionName}
          accent={state.shared.accent}
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
  if (state.kind === 'archived-empty') {
    return (
      <>
        {backLink}
        <CardDetailHeader
          name={cardDetail.name}
          bank={state.shared.institutionName}
          accent={state.shared.accent}
          tone="ok"
        />
        <CardActions cardId={id} isActive={false} hasMovements={state.shared.cardHasHistory} />
        <p className="py-6 text-center text-sm text-text-muted">{t('detail.archived_no_pending')}</p>
        <CardDetailsSection createdAt={cardDetail.created_at} archivedAt={cardDetail.created_at} />
      </>
    )
  }

  // ── Active: full detail view ────────────────────────────────────────────────
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
    <EditCardDrawerProvider card={editCardData(state.shared.committedARS)}>
      {backLink}
      <CardDetailHeader
        name={cardDetail.name}
        bank={state.shared.institutionName}
        accent={state.shared.accent}
        tone={state.shared.headerTone}
        actions={cardDetail.is_active ? <CardHeaderActions cardId={id} hasMovements={state.shared.cardHasHistory} /> : undefined}
      />

      {!cardDetail.is_active && <CardActions cardId={id} isActive={false} hasMovements={state.shared.cardHasHistory} />}

      <CardDetailView vm={state.vm} todayISO={todayISO} showCents={showCents} sideExtras={sideExtras} />
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
