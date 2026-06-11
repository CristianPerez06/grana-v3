import { notFound, redirect } from 'next/navigation'
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
    getAccountDetail(supabase, id),
    getInstitutions(supabase),
  ])

  if (!account) notFound()

  return <EditAccountForm account={account} institutions={institutions} />
}

export default EditAccountPage
