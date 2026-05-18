import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail, getInstitutions } from '@/lib/accounts/queries'
import { EditAccountForm } from './_components/edit-account-form'

type Props = {
  params: Promise<{ id: string }>
}

const EditAccountPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [account, institutions] = await Promise.all([
    getAccountDetail(id),
    getInstitutions(),
  ])

  if (!account) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {account.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">Editar</h1>
      </div>
      <EditAccountForm account={account} institutions={institutions} />
    </div>
  )
}

export default EditAccountPage
