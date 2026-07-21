import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/accounts/queries'
import { getHousehold, getHouseholdDebt } from '@grana/shared'
import type { BalanceCurrency } from '@grana/money-logic'
import { SettleForm } from './_components/settle-form'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

export default async function SharedSettlePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [household, debt, accounts] = await Promise.all([
    getHousehold(supabase),
    getHouseholdDebt(supabase),
    getAccounts(supabase),
  ])
  if (!household) return null

  const owed: Partial<Record<BalanceCurrency, number>> = {}
  for (const c of CURRENCIES) {
    const d = debt?.[c]
    if (d?.kind === 'owes' && d.from === user.id) owed[c] = d.amount
  }
  if (Object.keys(owed).length === 0) redirect('/shared')

  const myAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({
    id: a.id,
    name: a.name,
    institutionName: a.institution?.name ?? null,
    // Available balance per currency — drives the non-blocking negative-balance
    // notice when a settlement would push the chosen account below zero.
    balances: a.balances,
  }))
  const partnerName = household.members.find((m) => m.userId !== user.id)?.fullName ?? ''

  return <SettleForm owed={owed} accounts={myAccounts} partnerName={partnerName} />
}
