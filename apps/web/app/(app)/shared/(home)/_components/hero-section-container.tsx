import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getSharedAccruedMovements } from '@/lib/shared/queries'
import type { SharedExpenseItem } from '@/lib/shared/types'
import { HeroSection } from './hero-section'

// Server-renders the current month; the hero then follows the header's shared
// month selection client-side (getSharedAccruedMovements keyed by month).
export const HeroSectionContainer = async () => {
  const supabase = await createClient()
  const currentYm = formatDateISO(getTodayAR()).slice(0, 7)
  let data: SharedExpenseItem[]
  try {
    data = await getSharedAccruedMovements(supabase, currentYm)
  } catch {
    const tError = await getTranslations('error')
    return (
      <div className="flex min-h-[210px] items-center justify-center rounded-3xl border border-dashed border-navy-border bg-hero-navy p-6 text-center text-sm text-navy-muted">
        {tError('generic_title')}
      </div>
    )
  }
  return <HeroSection initialData={data} />
}
