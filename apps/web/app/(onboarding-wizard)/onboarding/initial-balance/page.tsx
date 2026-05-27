import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InitialBalanceForm } from './_components/initial-balance-form'

const InitialBalancePage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('type', 'cash')

  const billetera = (accounts ?? [])[0] ?? null

  if (!billetera) {
    // The default Billetera is created by trigger at signup. If it is missing,
    // bounce to done so the user at least exits the wizard.
    redirect('/onboarding/done')
  }

  return <InitialBalanceForm primaryAccount={billetera} />
}

export default InitialBalancePage
