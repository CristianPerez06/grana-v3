import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { RecurringTabs } from './_components/recurring-tabs'
import { UpcomingRecurrences } from './_components/upcoming-recurrences'
import { CreateRecurrenceButton } from './_components/create-recurrence-button'
import type { RecurrenceAccount } from './_components/create-recurrence-modal'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import {
  generateDueRecurrenceInstances,
  getRecurrences,
  getPendingRecurrenceInstances,
} from '@/lib/recurrences/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

const isFinished = (rule: RecurrenceSummary) => {
  if (!rule.end_date) return false
  return rule.end_date < formatDateISO(getTodayAR())
}

const activeCodes = (
  currencies: Array<{ currency_code: string; is_active: boolean }>,
): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

const RecurringPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await generateDueRecurrenceInstances()

  const tRec = await getTranslations('recurrences')

  const [allRules, pendingRecurrences, { cash, bank, credit }, categories] =
    await Promise.all([
      getRecurrences({ statuses: ['active', 'paused'] }),
      getPendingRecurrenceInstances(),
      getAccounts(),
      getAllCategories(user.id),
    ])

  const today = formatDateISO(getTodayAR())

  const active = allRules.filter((r) => r.status === 'active' && (!r.end_date || r.end_date >= today))
  const paused = allRules.filter((r) => r.status === 'paused' && (!r.end_date || r.end_date >= today))
  const finished = allRules.filter(isFinished)

  // Available balance for the soft negative-balance warning in the pending block.
  const availableByAccount: Record<string, Record<'ARS' | 'USD', number>> = {}
  for (const account of [...cash, ...bank]) {
    availableByAccount[account.id] = account.balances
  }

  // Accounts offered in the direct-creation modal (currency-aware).
  const recurrenceAccounts: RecurrenceAccount[] = [
    ...[...cash, ...bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      avatar: a.avatar,
    })),
    ...credit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
    })),
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={tRec('title')}
          description={tRec('description')}
          backLink={{ href: '/transactions', label: tRec('back_label') }}
        />
        <CreateRecurrenceButton accounts={recurrenceAccounts} categories={categories} />
      </div>

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <UpcomingRecurrences rules={active} />

      <RecurringTabs active={active} paused={paused} finished={finished} />
    </div>
  )
}

export default RecurringPage
