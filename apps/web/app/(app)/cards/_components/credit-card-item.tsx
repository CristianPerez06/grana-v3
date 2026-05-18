import Link from 'next/link'
import type { CreditCardSummary } from '@/lib/cards/queries'
import { formatARS, formatUSD } from '@/lib/format'
import { CardDatesFooter } from './card-dates-footer'

type Props = {
  card: CreditCardSummary
  showCents?: boolean
}

const alertBorderColors = {
  red: 'border-l-red-500',
  amber: 'border-l-amber-400',
  none: 'border-l-border',
}

export const CreditCardItem = ({ card, showCents = false }: Props) => {
  const period = card.activePeriod
  const alert = period?.alert ?? 'none'
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  const usedPercent =
    card.credit_limit && card.credit_limit > 0
      ? Math.min(100, Math.round((pendingARS / card.credit_limit) * 100))
      : null

  return (
    <Link
      href={`/cards/${card.id}`}
      className={`flex flex-col gap-3 rounded-xl border border-border border-l-4 ${alertBorderColors[alert]} bg-card p-4 shadow-sm hover:shadow-md transition-shadow min-w-[280px] snap-start`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{card.name}</p>
          {!card.is_active && (
            <span className="text-xs text-muted-foreground italic">Archivada</span>
          )}
        </div>
        {alert === 'red' && (
          <span className="shrink-0 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            Vencido
          </span>
        )}
        {alert === 'amber' && (
          <span className="shrink-0 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            Por vencer
          </span>
        )}
      </div>

      {/* Amounts */}
      <div>
        <p className="text-2xl font-bold tracking-tight">{formatARS(pendingARS, showCents)}</p>
        {hasUSD && pendingUSD > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">{formatUSD(pendingUSD)}</p>
        )}
      </div>

      {/* Credit limit bar */}
      {usedPercent !== null && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-amber-400' : 'bg-primary'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {usedPercent}% usado · {formatARS(card.credit_limit! - pendingARS, showCents)} disponible
          </p>
        </div>
      )}

      {/* Dates footer */}
      <CardDatesFooter
        endDate={period?.end_date ?? null}
        dueDate={period?.due_date ?? null}
        alert={alert}
        isEstimated={period?.is_estimated}
      />
    </Link>
  )
}
