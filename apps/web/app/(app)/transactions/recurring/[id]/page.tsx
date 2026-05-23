import { notFound } from 'next/navigation'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
import { PageHeader } from '@/components/ui/page-header'
import { RecurrenceDetailForm } from './_components/recurrence-detail-form'

const MOVEMENT_LABEL: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  paused: 'Pausada',
  deleted: 'Eliminada',
}

type Props = {
  params: Promise<{ id: string }>
}

const RecurrenceDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const rule = await getRecurrenceDetail(id)
  if (!rule) notFound()

  const movementLabel = MOVEMENT_LABEL[rule.movement_type] ?? '—'
  const accountName = rule.account?.name ?? '—'
  const destinationName = rule.destination_account?.name
  const statusLabel = STATUS_LABEL[rule.status] ?? rule.status
  const accountSummary =
    rule.movement_type === 'transfer'
      ? `${accountName} → ${destinationName ?? '—'}`
      : accountName

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        title={rule.description || rule.category?.name || movementLabel}
        description={`${statusLabel} · ${accountSummary} · ${rule.currency_code}`}
        backLink={{ href: '/transactions/recurring', label: 'Recurrencias' }}
      />

      <RecurrenceDetailForm rule={rule} />
    </div>
  )
}

export default RecurrenceDetailPage
