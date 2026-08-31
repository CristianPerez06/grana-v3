import { getTranslations } from 'next-intl/server'
import { getAvailableSums, getReserveFlowSums, getReserveHistory } from '@grana/savings'
import { getTodayAR } from '@grana/money-logic'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'
import { SavingsLedger } from './savings-ledger'

/**
 * El pie de la página: el puente con el banco y el historial.
 *
 * Sección propia con sus consultas, como la foto y el desglose. Si esto falla,
 * lo que se pierde es una explicación y una auditoría — el número sigue arriba y
 * la plata se puede seguir moviendo. Es la sección que MENOS importa de las
 * tres, y por eso es la que puede caerse sola.
 *
 * Las tres lecturas van juntas acá y no en tres secciones porque el puente y el
 * historial son la misma pregunta plegada dos veces: sin una de ellas, la otra
 * no se entiende sola.
 */
export const SavingsLedgerContainer = async () => {
  let data: Awaited<ReturnType<typeof read>>

  try {
    data = await read()
  } catch {
    const t = await getTranslations('savings.route')
    return <SectionFallback message={t('ledger_error')} className="min-h-[3rem]" />
  }

  return <SavingsLedger sums={data.sums} flow={data.flow} history={data.history} />
}

/** Las tres lecturas del pie, fuera del `try` que dibuja: un error de RENDER no
 *  es un error de datos, y atraparlo acá lo escondería detrás del mismo mensaje. */
const read = async () => {
  const supabase = await createClient()
  const today = getTodayAR()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [sums, flow, history] = await Promise.all([
    getAvailableSums(supabase),
    getReserveFlowSums(supabase, monthStart, today),
    getReserveHistory(supabase),
  ])

  return { sums, flow, history }
}
