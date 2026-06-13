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
 * "A pagar este mes" hero — the dark navy card of the cards module (same
 * surface as the dashboard hero). Left: the total to pay, ARS primary and USD
 * subordinate + SEPARATE (Bimoneda, never summed). Right: "Próximos cierres" —
 * the next close DATES (not payment due dates), each grouped with all the cards
 * that close that day (several cards often share a close date).
 */
export const CardsMonthHero = ({ summary, showCents = false }: Props) => {
  const t = useTranslations('cards')

  return (
    <Card className="border-transparent bg-surface-dark text-white">
      <CardContent className="grid grid-cols-1 gap-0 p-0 md:grid-cols-[1fr_1px_minmax(0,340px)]">
        {/* Left: aggregate "a pagar este mes" */}
        <div className="flex flex-col justify-center p-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/55">
            {t('month_hero.eyebrow')}
          </p>

          {summary.hasToPay ? (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[clamp(2.125rem,4.6vw,3.25rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
                {formatARS(summary.toPayARS, showCents)}
              </p>
              {summary.hasUSD && summary.toPayUSD !== 0 && (
                <p className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-emerald/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald">
                    USD
                  </span>
                  <span className="text-lg font-bold tabular-nums text-white/90">
                    {formatUSD(summary.toPayUSD, showCents)}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/70">{t('month_hero.empty')}</p>
          )}
        </div>

        {/* Divider */}
        <div className="hidden bg-white/10 md:block" aria-hidden />

        {/* Right: próximos cierres (grouped by date) */}
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
                  <span className="truncate text-sm font-semibold text-white/80">
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
