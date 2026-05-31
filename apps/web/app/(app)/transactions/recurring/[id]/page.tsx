import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
import { PageHeader } from '@/components/ui/page-header'
import { RecurrenceDetailForm } from './_components/recurrence-detail-form'
import { RecurrenceInstancesList } from './_components/recurrence-instances-list'

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

  // Creation date: created_at is a timestamptz; show the calendar day.
  const createdLabel = rule.created_at
    ? new Date(rule.created_at).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        title={rule.description || rule.category?.name || movementLabel}
        description={`${statusLabel} · ${accountSummary} · ${rule.currency_code}`}
        backLink={{ href: '/transactions/recurring', label: tRec('title') }}
      />

      {createdLabel && (
        <p className="-mt-4 text-sm text-text-muted">
          {tRec('created_on', { date: createdLabel })}
        </p>
      )}

      <RecurrenceDetailForm rule={rule} />

      <RecurrenceInstancesList
        instances={rule.instances}
        currencyCode={rule.currency_code}
      />
    </div>
  )
}

export default RecurrenceDetailPage
