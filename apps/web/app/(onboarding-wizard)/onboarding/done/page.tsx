import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completeOnboardingAction } from '@/app/_actions/onboarding'
import { OnboardingFork } from './_components/onboarding-fork'

const DonePage = async () => {
  // Mark onboarding as completed (idempotent — safe to revisit).
  await completeOnboardingAction()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aggregate initial_balance per currency across the user's active
  // cash + bank accounts. This is the "starting available" the user just
  // declared in /initial-balance.
  const { data: rows } = await supabase
    .from('account_currencies')
    .select('currency_code, initial_balance, accounts!inner(user_id, type, is_active)')
    .eq('accounts.user_id', user.id)
    .eq('accounts.is_active', true)
    .in('accounts.type', ['cash', 'bank'])

  const totals: Record<string, number> = { ARS: 0, USD: 0 }
  for (const row of rows ?? []) {
    const amount = Number(row.initial_balance ?? 0)
    totals[row.currency_code] = (totals[row.currency_code] ?? 0) + amount
  }

  return <OnboardingFork totalArs={totals.ARS ?? 0} totalUsd={totals.USD ?? 0} />
}

export default DonePage
