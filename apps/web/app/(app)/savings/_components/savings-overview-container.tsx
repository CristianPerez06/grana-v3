import { getTranslations } from 'next-intl/server'
import { getAvailableSums, getPurposeSums } from '@grana/savings'
import type { AvailableSums, PurposeSums } from '@grana/savings'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'
import { SavingsOverview } from './savings-overview'

/**
 * La lectura del módulo, en UNA consulta por concepto.
 *
 * `get_available_sums` ya devuelve el disponible restado y el guardado vigente;
 * `get_purpose_sums` devuelve el reparto por (propósito, moneda) con la fila de
 * «Sin destino» como resto derivado. Ninguna de las dos se recompone acá — es la
 * misma lectura normativa que consume el dashboard.
 */
export const SavingsOverviewContainer = async () => {
  let sums: AvailableSums[]
  let purposeSums: PurposeSums[]

  try {
    const supabase = await createClient()
    ;[sums, purposeSums] = await Promise.all([
      getAvailableSums(supabase),
      getPurposeSums(supabase),
    ])
  } catch {
    const t = await getTranslations('savings.route')
    return <SectionFallback message={t('error')} className="min-h-[14rem]" />
  }

  return <SavingsOverview sums={sums} purposeSums={purposeSums} />
}
