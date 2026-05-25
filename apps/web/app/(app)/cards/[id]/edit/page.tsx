import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardNetworks } from '@/lib/cards/queries'
import { getInstitutions } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
import { EditCreditCardForm } from './_components/edit-credit-card-form'

type Props = {
  params: Promise<{ id: string }>
}

const EditCardPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cardDetail, institutions, networks] = await Promise.all([
    getCreditCardDetail(id),
    getInstitutions(),
    getCardNetworks(),
  ])

  if (!cardDetail || cardDetail.type !== 'credit') notFound()

  const t = await getTranslations('cards')

  const networkLabel = cardDetail.network_id
    ? (networks.find((n) => n.id === cardDetail.network_id)?.name ?? t('labels.network_unknown'))
    : (cardDetail.other_network_name ?? t('labels.network_custom'))

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('edit.title')}
        backLink={{ href: `/cards/${id}`, label: cardDetail.name }}
      />

      <EditCreditCardForm
        cardId={id}
        initialName={cardDetail.name}
        initialInstitutionId={cardDetail.institution_id}
        initialCreditLimit={cardDetail.credit_limit}
        networkLabel={networkLabel}
        institutions={institutions}
      />
    </div>
  )
}

export default EditCardPage
