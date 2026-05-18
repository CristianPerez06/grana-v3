import type { CreditCardSummary } from '@/lib/cards/queries'
import { formatARS, formatUSD } from '@/lib/format'

type CardDetailData = {
  name: string
  is_active: boolean
  institution?: { name: string } | null
  other_network_name?: string | null
  currencies: Array<{ currency_code: string; is_active: boolean }>
  activePeriod: CreditCardSummary['activePeriod']
}

type Props = {
  card: CardDetailData
  showCents?: boolean
}

export const CardHero = ({ card, showCents = false }: Props) => {
  const period = card.activePeriod
  const alert = period?.alert ?? 'none'
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  return (
    <div className="flex flex-col gap-2">
      {/* Alert banner */}
      {alert === 'red' && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 font-medium">
          Resumen vencido — evitá cargos por mora
        </div>
      )}
      {alert === 'amber' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
          El vencimiento se acerca
        </div>
      )}

      {/* Card identity */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{card.name}</h1>
          {card.institution && (
            <p className="text-sm text-muted-foreground">{card.institution.name}</p>
          )}
        </div>
      </div>

      {/* Eyebrow */}
      {period && (
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {period.variant === 'tarjeta_nueva' ? 'Sin movimientos' : 'Resumen en curso'}
        </p>
      )}

      {/* Primary amount */}
      <p className="text-4xl font-bold tracking-tight">{formatARS(pendingARS, showCents)}</p>
      {hasUSD && pendingUSD > 0 && (
        <p className="text-sm text-muted-foreground">{formatUSD(pendingUSD)} USD</p>
      )}
    </div>
  )
}
