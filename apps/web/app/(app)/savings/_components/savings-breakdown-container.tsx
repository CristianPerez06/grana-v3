import { getTranslations } from 'next-intl/server'
import { getPurposeSums, listPurposes } from '@grana/savings'
import type { Purpose, PurposeSums } from '@grana/savings'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'
import { SavingsBreakdown } from './savings-breakdown'

/**
 * El desglose por propósito. DOS lecturas, y las dos hacen falta:
 *
 * `get_purpose_sums` dice cuánto tiene cada uno, pero sale de la tabla de
 * repartos, así que un propósito recién creado no figura en ninguna fila.
 * `listPurposes` dice cuáles EXISTEN. Sin la segunda, crear uno y no verlo era
 * indistinguible de que no se hubiera creado.
 *
 * Van juntas en una sección y no en dos porque son la misma pregunta —«para qué
 * está guardado»— y media respuesta no sirve: una lista sin montos o unos montos
 * sin los propósitos vacíos son las dos igual de engañosas.
 */
export const SavingsBreakdownContainer = async () => {
  let data: { purposeSums: PurposeSums[]; purposes: Purpose[] }

  try {
    const supabase = await createClient()
    const [purposeSums, purposes] = await Promise.all([
      getPurposeSums(supabase),
      listPurposes(supabase),
    ])
    data = { purposeSums, purposes }
  } catch {
    const t = await getTranslations('savings.route')
    return <SectionFallback message={t('breakdown_error')} className="min-h-[12rem]" />
  }

  return <SavingsBreakdown purposeSums={data.purposeSums} purposes={data.purposes} />
}
