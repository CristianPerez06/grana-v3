import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { CardPeriodDetail } from '@/lib/cards/queries'
import type { PeriodVariant } from '@/lib/cards/types'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { EstimatedDateBadge } from '../../../_components/estimated-date-badge'

const periodDateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
})

// "04 jun 26" — short and readable. Built from parts to avoid the es-AR
// "04 de jun de 26" connectors that `format()` inserts.
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const parts = periodDateFmt.formatToParts(new Date(y, m - 1, d))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}`
}

const variantLabelKey: Record<PeriodVariant, string> = {
  futuro: 'period.future',
  actual: 'period.current',
  tarjeta_nueva: 'period.no_movements',
  cerrado_esperando_pago: 'period.pending_payment',
  vencido: 'period.overdue',
  pagado: 'period.paid',
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
  const t = useTranslations('cards')
  if (periods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t('list.periods_empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {periods.map((period) => {
        // Paid periods show what WAS paid; unpaid show what's pending — per currency.
        const totalAmount = period.has_payment ? period.paidAmountARS : period.pendingAmountARS
        const totalUSD = period.has_payment ? period.paidAmountUSD : period.pendingAmountUSD

        return (
          <Link
            key={period.id}
            href={`/cards/${cardId}/periods/${period.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {formatDate(period.start_date)} – {formatDate(period.end_date)}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${variantColors[period.variant]}`}>
                  {t(variantLabelKey[period.variant])}
                </span>
                {period.is_estimated && <EstimatedDateBadge />}
              </div>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t('period.due_prefix')} {formatDate(period.due_date)}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                {formatARS(totalAmount, showCents)}
              </span>
              {hasUSD && totalUSD > 0 && (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatUSD(totalUSD, showCents)}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
