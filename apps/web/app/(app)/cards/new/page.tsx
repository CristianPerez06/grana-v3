import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { getCardNetworks } from '@/lib/cards/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateCreditCardForm } from './_components/create-credit-card-form'
import { CreateNovatoCreditCardForm } from './_components/create-novato-credit-card-form'

const NewCardPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('mode')
    .eq('id', user.id)
    .single()
  const isNovato = profile?.mode === 'novato'

  const [institutions, networks] = await Promise.all([
    getInstitutions(),
    getCardNetworks(),
  ])

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title="Nueva tarjeta de crédito"
        description={
          isNovato
            ? 'Solo necesitamos la fecha de cierre del próximo resumen.'
            : 'Ingresá los datos de tu tarjeta y las fechas del ciclo actual.'
        }
        backLink={{ href: '/cards', label: 'Tarjetas' }}
      />

      {isNovato ? (
        <CreateNovatoCreditCardForm institutions={institutions} networks={networks} />
      ) : (
        <CreateCreditCardForm institutions={institutions} networks={networks} />
      )}
    </div>
  )
}

export default NewCardPage
