import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
import { createClient } from '@/lib/supabase/server'
import { RecurrenceDetail } from './_components/recurrence-detail'
import { RecurrenceInstancesList } from './_components/recurrence-instances-list'
import { RecurrenceNotice } from '../_components/recurrence-notice'

type Props = {
  params: Promise<{ id: string }>
  /**
   * De dónde se llegó, con la misma convención que el detalle de un movimiento
   * (`from=transaction:<id>`). Sin esto, la ficha de un movimiento vinculado
   * llevaba a la regla y la regla devolvía al hub: el camino de vuelta al
   * movimiento no existía.
   */
  searchParams: Promise<{ from?: string }>
}

const RecurrenceDetailPage = async ({ params, searchParams }: Props) => {
  const { id } = await params
  const { from } = await searchParams
  const rule = await getRecurrenceDetail(await createClient(), id)
  if (!rule) notFound()

  const tRec = await getTranslations('recurrences')
  const back = from?.startsWith('transaction:')
    ? {
        href: `/transactions/${from.slice('transaction:'.length)}`,
        label: tRec('back_to_movement'),
      }
    : { href: '/transactions/recurring', label: tRec('title') }

  return (
    <>
      <RecurrenceDetail rule={rule} back={back} />

      {/* El acuse de desvincular vive acá y no en el botón: ese botón deja de
          ofrecerse en cuanto la ocurrencia vuelve a «por revisar». */}
      <RecurrenceNotice>
        <RecurrenceInstancesList
          instances={rule.instances}
          currencyCode={rule.currency_code}
        />
      </RecurrenceNotice>
    </>
  )
}

export default RecurrenceDetailPage
