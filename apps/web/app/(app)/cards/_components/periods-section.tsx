import Link from 'next/link'
import type { CardPeriodDetail } from '@/lib/cards/queries'
import { PeriodCard } from './period-card'

type Props = {
  cardId: string
  periods: CardPeriodDetail[]
  hasUSD?: boolean
  showCents?: boolean
}

export const PeriodsSection = ({ cardId, periods, hasUSD = false, showCents = false }: Props) => {
  // Show at most 2 non-paid periods (actual + next), or most recent if all paid
  const activePeriods = periods
    .filter((p) => !p.has_payment)
    .slice(0, 2)

  const displayPeriods = activePeriods.length > 0 ? activePeriods : periods.slice(0, 1)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Resúmenes
        </h2>
        <Link
          href={`/cards/${cardId}/periods`}
          className="text-xs text-primary hover:underline"
        >
          Ver historial completo
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {displayPeriods.map((period) => (
          <PeriodCard key={period.id} period={period} cardId={cardId} hasUSD={hasUSD} showCents={showCents} />
        ))}
      </div>
    </section>
  )
}
