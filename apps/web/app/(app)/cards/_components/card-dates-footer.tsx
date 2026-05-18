import type { CardPeriodAlert } from '@/lib/cards/queries'
import { EstimatedDateBadge } from './estimated-date-badge'

type Props = {
  endDate: string | null
  dueDate: string | null
  alert: CardPeriodAlert
  isEstimated?: boolean
}

const formatShortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const alertColors: Record<CardPeriodAlert, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  none: 'text-muted-foreground',
}

export const CardDatesFooter = ({ endDate, dueDate, alert, isEstimated }: Props) => {
  if (!endDate && !dueDate) {
    return (
      <p className="text-xs text-muted-foreground italic">Sin ciclo asignado</p>
    )
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {endDate && (
        <span className="text-muted-foreground">
          Cierra <span className="font-medium">{formatShortDate(endDate)}</span>
        </span>
      )}
      {dueDate && (
        <span className={alertColors[alert]}>
          Vence <span className="font-medium">{formatShortDate(dueDate)}</span>
        </span>
      )}
      {isEstimated && <EstimatedDateBadge />}
    </div>
  )
}
