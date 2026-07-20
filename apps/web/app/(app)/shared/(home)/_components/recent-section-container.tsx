import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getSharedExpenses } from '@/lib/shared/queries'
import type { SharedExpenseItem } from '@/lib/shared/types'
import { RecentSection } from './recent-section'

// Server-renders the current month; the list then follows the header's shared
// month selection client-side (getSharedExpenses keyed by month). `todayISO`
// and `userId` are month-invariant, resolved once here and passed down so the
// client section can label "Hoy/Ayer" and "Pagaste/Pagó {name}".
export const RecentSectionContainer = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = formatDateISO(getTodayAR())
  const currentYm = todayISO.slice(0, 7)
  let data: SharedExpenseItem[]
  try {
    data = await getSharedExpenses(supabase, { month: currentYm })
  } catch {
    const tError = await getTranslations('error')
    return (
      <section className="flex flex-col gap-3">
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted">
          {tError('generic_title')}
        </div>
      </section>
    )
  }
  return <RecentSection initialData={data} todayISO={todayISO} userId={user.id} />
}
