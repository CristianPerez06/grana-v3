import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCreditCardDetail, getCardNetworks } from '@/lib/cards/queries'
import { getInstitutions } from '@/lib/accounts/queries'
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

  const networkLabel = cardDetail.network_id
    ? (networks.find((n) => n.id === cardDetail.network_id)?.name ?? 'Desconocida')
    : (cardDetail.other_network_name ?? 'Personalizada')

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/cards/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {cardDetail.name}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Editar tarjeta</h1>

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
