import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRecurrenceDetail } from '@/lib/recurrences/queries'
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

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center gap-3">
        <Link
          href="/transactions/recurring"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Recurrencias
        </Link>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {STATUS_LABEL[rule.status] ?? rule.status}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {rule.description || rule.category?.name || movementLabel}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rule.movement_type === 'transfer'
            ? `${accountName} → ${destinationName ?? '—'}`
            : accountName}
          {' · '}
          {rule.currency_code}
        </p>
      </div>

      <RecurrenceDetailForm rule={rule} />
    </div>
  )
}

export default RecurrenceDetailPage
