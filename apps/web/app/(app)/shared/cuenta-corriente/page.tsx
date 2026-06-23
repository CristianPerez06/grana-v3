import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAccount } from '@/lib/shared/queries'
import { CurrentAccountView } from './_components/current-account-view'

export default async function CuentaCorrientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getCurrentAccount(supabase)
  if (!data) redirect('/shared')

  return <CurrentAccountView data={data} />
}
