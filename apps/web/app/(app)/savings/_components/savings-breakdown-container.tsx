import { getTranslations } from 'next-intl/server'
import { getPurposeSums } from '@grana/savings'
import type { PurposeSums } from '@grana/savings'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'
import { SavingsBreakdown } from './savings-breakdown'

/** El desglose por propósito: depende SOLO de `get_purpose_sums`. */
export const SavingsBreakdownContainer = async () => {
  let purposeSums: PurposeSums[]

  try {
    const supabase = await createClient()
    purposeSums = await getPurposeSums(supabase)
  } catch {
    const t = await getTranslations('savings.route')
    return <SectionFallback message={t('breakdown_error')} className="min-h-[12rem]" />
  }

  return <SavingsBreakdown purposeSums={purposeSums} />
}
