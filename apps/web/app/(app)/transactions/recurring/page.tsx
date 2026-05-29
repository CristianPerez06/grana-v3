import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { RecurringTabs } from './_components/recurring-tabs'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import {
  generateDueRecurrenceInstances,
  getRecurrences,
  getPendingRecurrenceInstances,
} from '@/lib/recurrences/queries'
import { getAccounts } from '@/lib/accounts/queries'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

const isFinished = (rule: RecurrenceSummary) => {
  if (!rule.end_date) return false
  return rule.end_date < formatDateISO(getTodayAR())
}

const RecurringPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await generateDueRecurrenceInstances()

  const tRec = await getTranslations('recurrences')

  const [allRules, pendingRecurrences] = await Promise.all([
    getRecurrences({ statuses: ['active', 'paused'] }),
    getPendingRecurrenceInstances(),
  ])

  const today = formatDateISO(getTodayAR())

  const active = allRules.filter((r) => r.status === 'active' && (!r.end_date || r.end_date >= today))
  const paused = allRules.filter((r) => r.status === 'paused' && (!r.end_date || r.end_date >= today))
  const finished = allRules.filter(isFinished)

  // Available balance for soft negative-balance warning in the pending block.
  const availableByAccount: Record<string, Record<'ARS' | 'USD', number>> = {}
  if (pendingRecurrences.length > 0) {
    const { cash, bank } = await getAccounts()
    for (const account of [...cash, ...bank]) {
      availableByAccount[account.id] = account.balances
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={tRec('title')}
        description={tRec('description')}
        backLink={{ href: '/transactions', label: tRec('back_label') }}
      />

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <RecurringTabs
        active={active}
        paused={paused}
        finished={finished}
      />
    </div>
  )
}

export default RecurringPage
