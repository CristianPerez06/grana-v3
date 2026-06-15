import { redirect } from 'next/navigation'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { RecurringTabs } from './_components/recurring-tabs'
import { UpcomingRecurrences } from './_components/upcoming-recurrences'
import { RecurrenceGenerationTrigger } from './_components/recurrence-generation-trigger'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import {
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

  const [allRules, pendingRecurrences, { cash, bank }] =
    await Promise.all([
      getRecurrences(supabase, { statuses: ['active', 'paused'] }),
      getPendingRecurrenceInstances(supabase),
      getAccounts(supabase),
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

  return (
    <>
      <RecurrenceGenerationTrigger />

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <UpcomingRecurrences rules={active} />

      <RecurringTabs active={active} paused={paused} finished={finished} />
    </>
  )
}

export default RecurringPage
