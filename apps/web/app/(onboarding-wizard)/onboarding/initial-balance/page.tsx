import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InitialBalanceForm } from './_components/initial-balance-form'

const InitialBalancePage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('mode')
    .eq('id', user.id)
    .single()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('type', ['cash', 'bank'])

  const list = accounts ?? []
  const bank = list.find((a) => a.type === 'bank') ?? null
  const cash = list.find((a) => a.type === 'cash') ?? null

  if (!cash) {
    // The default Billetera should always exist (created by trigger). If it
    // is missing, something is wrong with the user setup — fail safe by
    // bouncing them to done so they at least exit the wizard.
    redirect('/onboarding/done')
  }

  // Experto with bank: primary = bank, secondary cash = Billetera.
  // Otherwise: primary = Billetera, no secondary cash.
  const primary = bank ?? cash
  const secondaryCash = bank ? cash : null

  return (
    <InitialBalanceForm
      mode={profile?.mode === 'experto' ? 'experto' : 'novato'}
      primaryAccount={primary}
      secondaryCashAccount={secondaryCash}
    />
  )
}

export default InitialBalancePage
