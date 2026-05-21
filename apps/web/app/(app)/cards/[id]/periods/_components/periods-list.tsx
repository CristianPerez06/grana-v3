import Link from 'next/link'
import type { CardPeriodDetail } from '@/lib/cards/queries'
import type { PeriodVariant } from '@/lib/cards/types'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { EstimatedDateBadge } from '../../../_components/estimated-date-badge'

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
  periods: CardPeriodDetail[]
  cardId: string
  hasUSD?: boolean
  showCents?: boolean
}

export const PeriodsList = ({ periods, cardId, hasUSD = false, showCents = false }: Props) => {
  if (periods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay resúmenes registrados.
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {periods.map((period) => {
        const totalAmount = period.has_payment ? period.paidAmountARS : period.pendingAmountARS

        return (
          <Link
            key={period.id}
            href={`/cards/${cardId}/periods/${period.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {formatDate(period.start_date)} – {formatDate(period.end_date)}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${variantColors[period.variant]}`}>
                  {variantLabel[period.variant]}
                </span>
                {period.is_estimated && <EstimatedDateBadge />}
              </div>
              <div className="mt-0.5">
                <span className="font-medium text-sm">{formatARS(totalAmount, showCents)}</span>
                {hasUSD && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatUSD(period.pendingAmountUSD, showCents)}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              Vence {formatDate(period.due_date)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
