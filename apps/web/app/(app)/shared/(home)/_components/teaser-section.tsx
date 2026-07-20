import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChevronRight, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { countPendingSharedRecurrenceInstances } from '@/lib/recurrences/queries'

// Non-actionable teaser: flags shared recurrences pending confirmation and links
// to the hub (the confirm action lives only there, not in Compartido). Today-
// anchored; own boundary so it never blocks the month-scoped sections.
export const TeaserSection = async () => {
  const supabase = await createClient()
  const t = await getTranslations('shared')
  const count = await countPendingSharedRecurrenceInstances(supabase)
  if (count <= 0) return null

  return (
    <Link
      href="/transactions/recurring"
      className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
      >
        <Repeat className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight text-text">
          {t('dashboard.recurrence_teaser_title', { count })}
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-text-muted">
          {t('dashboard.recurrence_teaser_hint')}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-text-soft" aria-hidden />
    </Link>
  )
}
