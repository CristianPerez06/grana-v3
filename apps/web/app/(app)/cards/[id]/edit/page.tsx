import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardNetworks } from '@/lib/cards/queries'
import { getInstitutions } from '@/lib/accounts/queries'
import { getTodayAR } from '@/lib/date'
import { formatDateISO } from '@/lib/cards/utils'
import { cardAccent, resolveEditCycle } from '@grana/cards'
import { EditCardForm } from '../_components/edit-card-form'

type Props = {
  params: Promise<{ id: string }>
}

/**
 * No-JS / deep-link fallback for editing a card. The primary path is the
 * EditCardDrawer opened from the card detail; this route renders the same
 * EditCardForm inline (`variant="page"`).
 */
const EditCardPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, institutions, networks, t] = await Promise.all([
    getCreditCardDetail(supabase, id),
    getInstitutions(supabase),
    getCardNetworks(supabase),
    getTranslations('cards'),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const todayISO = formatDateISO(getTodayAR())

  const network = cardDetail.network_id
    ? networks.find((n: (typeof networks)[number]) => n.id === cardDetail.network_id) ?? null
    : null
  const networkLabel = network
    ? network.name
    : cardDetail.other_network_name ?? t('labels.network_custom')
  const networkColor = network?.brand_color ?? null

  const accent = cardAccent(
    {
      id: cardDetail.id,
      name: cardDetail.name,
      color_key: cardDetail.color_key,
      icon_key: cardDetail.icon_key,
    },
    cardDetail.institution,
  )

  return (
    <EditCardForm
      variant="page"
      cardId={id}
      initialName={cardDetail.name}
      initialInstitutionId={cardDetail.institution_id}
      initialCreditLimit={cardDetail.credit_limit}
      networkLabel={networkLabel}
      networkColor={networkColor}
      accent={accent}
      committedARS={0}
      cycle={resolveEditCycle(cardDetail.periods, todayISO)}
      institutions={institutions}
    />
  )
}

export default EditCardPage
