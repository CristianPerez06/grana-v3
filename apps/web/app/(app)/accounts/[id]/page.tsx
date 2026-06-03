import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { AccountDetailShell } from './_components/account-detail-shell'

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Server shell for /accounts/[id]. Resolves only the guards that the route
 * cannot defer to a client loading state:
 *   - Auth (redirect to /login when no session)
 *   - notFound() when the account does not exist or belongs to another user
 *   - redirect('/cards/[id]') when the account is a credit card (different UI)
 *
 * Once those pass, the page mounts the client shell which fetches everything
 * it needs via TanStack Query (account detail, ascending history, institutions,
 * pending reimbursements, filter options). The shell renders its chrome from
 * the first paint, with skeletons for the dynamic parts.
 */
const AccountDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const account = await getAccountDetail(id)
  if (!account) notFound()
  if (account.type === 'credit') redirect(`/cards/${id}`)

  return <AccountDetailShell accountId={id} />
}

export default AccountDetailPage
