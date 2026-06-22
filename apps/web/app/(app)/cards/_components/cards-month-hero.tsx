import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Card, CardContent } from '@/components/ui/card'
import type { CardsMonthSummary } from '@/lib/cards/queries'
import { formatDayMonth } from './card-presentation'

type Props = {
  summary: CardsMonthSummary
  showCents?: boolean
}

/**
 * Hero del mes — card navy del módulo Tarjetas (misma superficie que el hero del
 * dashboard). Izquierda: DOS cifras en Bimoneda (ARS primario + USD subordinado,
 * nunca sumados ni convertidos):
 * - "A pagar" — deuda firme (resúmenes cerrados e impagos). Siempre muestra un
 *   número (`$ 0` incluido), nunca un texto de empty-state.
 * - "En curso" — resúmenes abiertos devengándose; un piso que crece hasta el
 *   cierre (no una estimación), con el caption "se sigue sumando hasta el cierre".
 * Derecha: "Próximos cierres" — fecha de cierre · tarjeta · monto, capado en 3.
 * En viewports angostos las zonas se apilan (grid → 1 columna).
 */
export const CardsMonthHero = ({ summary, showCents = false }: Props) => {
  const t = useTranslations('cards')

  return (
    <Card className="border-transparent bg-surface-dark text-white">
      <CardContent className="grid grid-cols-1 gap-0 p-0 md:grid-cols-[1fr_1px_minmax(0,340px)]">
        {/* Left: A pagar (ahora) + En curso */}
        <div className="flex flex-col gap-5 p-7">
          {/* A pagar (ahora) — deuda firme */}
          <div className="flex flex-col">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
              {t('month_hero.to_pay_label')}
            </p>
            <p className="mt-1.5 text-[clamp(2rem,4.4vw,3rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              {formatARS(summary.toPayARS, showCents)}
            </p>
            {summary.hasUSD && summary.toPayUSD !== 0 && (
              <p className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full bg-emerald/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald">
                  USD
                </span>
                <span className="text-lg font-bold tabular-nums text-white/90">
                  {formatUSD(summary.toPayUSD, showCents)}
                </span>
              </p>
            )}
          </div>

          {/* En curso — resúmenes abiertos, sigue sumando hasta el cierre */}
          <div className="flex flex-col border-t border-white/10 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
              {t('month_hero.in_progress_label')}
            </p>
            <p className="mt-1 text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums text-white/90">
              {formatARS(summary.inProgressARS, showCents)}
            </p>
            {summary.hasUSD && summary.inProgressUSD !== 0 && (
              <p className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald">
                  USD
                </span>
                <span className="text-base font-bold tabular-nums text-white/80">
                  {formatUSD(summary.inProgressUSD, showCents)}
                </span>
              </p>
            )}
            <p className="mt-1.5 text-[12px] text-white/45">{t('month_hero.in_progress_caption')}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden bg-white/10 md:block" aria-hidden />

        {/* Right: próximos cierres con monto */}
        <div className="flex flex-col gap-3 border-t border-white/10 p-7 md:border-t-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
            {t('month_hero.next_closes_label')}
          </p>
          {summary.nextCloses.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {summary.nextCloses.map((close, i) => (
                <li key={`${close.endDate}-${i}`} className="flex items-baseline gap-3">
                  <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-white">
                    {formatDayMonth(close.endDate)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/80">
                    {close.cardName}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50">{t('month_hero.next_closes_empty')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
