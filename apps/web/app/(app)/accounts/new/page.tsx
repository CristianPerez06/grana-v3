import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInstitutions } from '@/lib/accounts/queries'
import { CreateAccountForm } from './_components/create-account-form'

const NewAccountPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const institutions = await getInstitutions()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Cuentas
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">Crear cuenta</h1>
      </div>
      <CreateAccountForm institutions={institutions} />
    </div>
  )
}

export default NewAccountPage
