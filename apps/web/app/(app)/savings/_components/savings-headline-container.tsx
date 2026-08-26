import { getTranslations } from 'next-intl/server'
import { getAvailableSums } from '@grana/savings'
import type { AvailableSums } from '@grana/savings'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'
import { SavingsHeadline } from './savings-headline'

/**
 * La foto y las acciones: dependen SOLO de `get_available_sums`.
 *
 * El desglose por propósito llega como `children` y trae su propia consulta, así
 * que si esa falla se cae solo el desglose — la foto y los botones siguen. Es la
 * parte que más importa: el número está, y la plata se puede sacar.
 */
export const SavingsHeadlineContainer = async ({ children }: { children: React.ReactNode }) => {
  let sums: AvailableSums[]

  try {
    const supabase = await createClient()
    sums = await getAvailableSums(supabase)
  } catch {
    const t = await getTranslations('savings.route')
    return <SectionFallback message={t('headline_error')} className="min-h-[9rem]" />
  }

  return <SavingsHeadline sums={sums}>{children}</SavingsHeadline>
}
