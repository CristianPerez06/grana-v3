import Link from 'next/link'
import type { CardPeriodDetail } from '@/lib/cards/queries'
import type { PeriodVariant } from '@/lib/cards/types'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { EstimatedDateBadge } from './estimated-date-badge'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const variantLabel: Record<PeriodVariant, string> = {
  futuro: 'Futuro',
  actual: 'En curso',
  tarjeta_nueva: 'Sin movimientos',
  cerrado_esperando_pago: 'Pendiente de pago',
  vencido: 'Vencido',
  pagado: 'Pagado',
}

const variantColors: Record<PeriodVariant, string> = {
  futuro: 'text-muted-foreground bg-muted',
  actual: 'text-blue-700 bg-blue-50',
  tarjeta_nueva: 'text-muted-foreground bg-muted',
  cerrado_esperando_pago: 'text-amber-700 bg-amber-50',
  vencido: 'text-red-700 bg-red-50',
  pagado: 'text-green-700 bg-green-50',
}

type Props = {
  period: CardPeriodDetail
  cardId: string
  hasUSD?: boolean
  showCents?: boolean
}

export const PeriodCard = ({ period, cardId, hasUSD = false, showCents = false }: Props) => {
  const label = variantLabel[period.variant]
  const colorClass = variantColors[period.variant]
  const totalAmount = period.has_payment ? period.paidAmountARS : period.pendingAmountARS

  return (
    <Link
      href={`/cards/${cardId}/periods/${period.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {formatDate(period.start_date)} – {formatDate(period.end_date)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
          {label}
        </span>
      </div>

      <div>
        <p className="text-xl font-bold">{formatARS(totalAmount, showCents)}</p>
        {hasUSD && (
          <p className="text-xs text-muted-foreground">{formatUSD(period.pendingAmountUSD, showCents)}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Vence {formatDate(period.due_date)}
          {period.has_payment && period.paymentDate && (
            <> · Pagado {formatDate(period.paymentDate)}</>
          )}
        </span>
        {period.is_estimated && <EstimatedDateBadge />}
      </div>
    </Link>
  )
}
