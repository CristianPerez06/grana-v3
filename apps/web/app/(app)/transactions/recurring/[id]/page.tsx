import { notFound } from 'next/navigation'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
import { createClient } from '@/lib/supabase/server'
import { RecurrenceDetail } from './_components/recurrence-detail'
import { RecurrenceInstancesList } from './_components/recurrence-instances-list'

type Props = {
  params: Promise<{ id: string }>
}

const RecurrenceDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const rule = await getRecurrenceDetail(await createClient(), id)
  if (!rule) notFound()

  return (
    <>
      <RecurrenceDetail rule={rule} />

      <RecurrenceInstancesList
        instances={rule.instances}
        currencyCode={rule.currency_code}
      />
    </>
  )
}

export default RecurrenceDetailPage
