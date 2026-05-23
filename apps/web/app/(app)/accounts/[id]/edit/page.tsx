import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail, getInstitutions } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
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
      <PageHeader
        title="Editar cuenta"
        backLink={{ href: `/accounts/${id}`, label: account.name }}
      />
      <EditAccountForm account={account} institutions={institutions} />
    </div>
  )
}

export default EditAccountPage
