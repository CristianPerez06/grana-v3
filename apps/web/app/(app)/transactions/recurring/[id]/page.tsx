import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
import { PageHeader } from '@/components/ui/page-header'
import { RecurrenceDetailForm } from './_components/recurrence-detail-form'

type Props = {
  params: Promise<{ id: string }>
}

const RecurrenceDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const rule = await getRecurrenceDetail(id)
  if (!rule) notFound()

  const tRec = await getTranslations('recurrences')
  const tTx = await getTranslations('transactions')

  const movementLabel =
    rule.movement_type === 'income' ||
    rule.movement_type === 'expense' ||
    rule.movement_type === 'transfer' ||
    rule.movement_type === 'adjustment'
      ? tTx(`types.${rule.movement_type}`)
      : '—'

  const statusLabel =
    rule.status === 'active' ||
    rule.status === 'paused' ||
    rule.status === 'deleted' ||
    rule.status === 'finished'
      ? tRec(`statuses.${rule.status}`)
      : rule.status

  const accountName = rule.account?.name ?? '—'
  const destinationName = rule.destination_account?.name
  const accountSummary =
    rule.movement_type === 'transfer'
      ? `${accountName} → ${destinationName ?? '—'}`
      : accountName

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        title={rule.description || rule.category?.name || movementLabel}
        description={`${statusLabel} · ${accountSummary} · ${rule.currency_code}`}
        backLink={{ href: '/transactions/recurring', label: tRec('title') }}
      />

      <RecurrenceDetailForm rule={rule} />
    </div>
  )
}

export default RecurrenceDetailPage
