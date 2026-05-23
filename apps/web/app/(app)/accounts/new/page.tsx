import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
import { CreateAccountForm } from './_components/create-account-form'

const NewAccountPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const institutions = await getInstitutions()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title="Crear cuenta"
        backLink={{ href: '/accounts', label: 'Cuentas' }}
      />
      <CreateAccountForm institutions={institutions} />
    </div>
  )
}

export default NewAccountPage
