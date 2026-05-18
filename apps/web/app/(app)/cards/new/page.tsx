import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { getCardNetworks } from '@/lib/cards/queries'
import { CreateCreditCardForm } from './_components/create-credit-card-form'

const NewCardPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [institutions, networks] = await Promise.all([
    getInstitutions(),
    getCardNetworks(),
  ])

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href="/cards"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Tarjetas
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva tarjeta de crédito</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ingresá los datos de tu tarjeta y las fechas del ciclo actual.
        </p>
      </div>

      <CreateCreditCardForm institutions={institutions} networks={networks} />
    </div>
  )
}

export default NewCardPage
