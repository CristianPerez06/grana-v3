import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { getAccounts } from '@/lib/accounts/queries'
import { getHousehold, getHouseholdDebt } from '@/lib/shared/queries'
import type { BalanceCurrency } from '@grana/money-logic'
import { SettleForm } from './_components/settle-form'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

export default async function SharedSettlePage() {
  const household = await getHousehold()
  if (!household || household.members.length < 2) redirect('/shared')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [debt, accounts] = await Promise.all([getHouseholdDebt(), getAccounts()])

  const owed: Partial<Record<BalanceCurrency, number>> = {}
  for (const c of CURRENCIES) {
    const d = debt?.[c]
    if (d?.kind === 'owes' && d.from === user.id) owed[c] = d.amount
  }
  if (Object.keys(owed).length === 0) redirect('/shared')

  const myAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({ id: a.id, name: a.name }))
  const partnerName = household.members.find((m) => m.userId !== user.id)?.fullName ?? ''
  const t = await getTranslations('shared')

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader title={t('settle.title')} backLink={{ href: '/shared', label: t('title') }} />
      <SettleForm owed={owed} accounts={myAccounts} partnerName={partnerName} />
    </div>
  )
}
