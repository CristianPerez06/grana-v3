import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import type { CardsMonthSummary } from '@/lib/cards/queries'
import { formatDayMonth } from './card-presentation'

type Props = {
  summary: CardsMonthSummary
  showCents?: boolean
}

/**
 * "A pagar este mes" hero: aggregates the total to pay across all cards. ARS is
 * primary (large type); USD is shown subordinate and SEPARATE — never summed or
 * converted (Bimoneda). The right column lists upcoming due dates.
 */
export const CardsMonthHero = ({ summary, showCents = false }: Props) => {
  const t = useTranslations('cards')
  const hasUpcoming = summary.upcoming.length > 0

  return (
    <Card asChild>
    <section className="grid grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_1px_360px]">
      {/* Left: aggregate "a pagar este mes" amount + next due highlight */}
      <div className="flex flex-col gap-4 p-7">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-soft">
          {t('month_hero.eyebrow')}
        </p>

        {summary.hasToPay ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[52px] font-extrabold leading-none tracking-[-0.045em] tabular-nums">
                {formatARS(summary.toPayARS, showCents)}
              </p>
              {summary.hasUSD && summary.toPayUSD > 0 && (
                <p className="text-lg font-bold text-text-muted tabular-nums">
                  {formatUSD(summary.toPayUSD, showCents)}
                </p>
              )}
            </div>

            {summary.nextDue?.isToPay && (
              <div className="mt-1 flex items-center gap-3 rounded-2xl bg-warning-bg px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-warning-deep">
                    {t('month_hero.next_due_label')}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {t('month_hero.next_due_value', {
                      card: summary.nextDue.cardName,
                      date: formatDayMonth(summary.nextDue.dueDate),
                    })}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">{t('month_hero.empty')}</p>
        )}
      </div>

      {/* Divider */}
      <div className="hidden bg-border md:block" aria-hidden />

      {/* Right: upcoming due dates — every active card's next due date */}
      <div className="flex flex-col gap-3 border-t border-border p-7 md:border-t-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-soft">
          {t('month_hero.upcoming_title')}
        </p>
        {hasUpcoming ? (
          <ul className="flex flex-col gap-3">
            {summary.upcoming.map((due) => (
              <li key={due.cardId} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-border-soft leading-none">
                  <span className="text-sm font-extrabold tabular-nums">
                    {due.dueDate.split('-')[2]}
                  </span>
                  <span className="text-[10px] font-semibold uppercase text-text-soft">
                    {monthAbbrev(due.dueDate)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{due.cardName}</p>
                  <p className="text-xs text-text-muted">
                    {due.isToPay
                      ? t('month_hero.upcoming_due', { date: formatDayMonth(due.dueDate) })
                      : t('month_hero.upcoming_open', { date: formatDayMonth(due.endDate) })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {formatARS(due.amountARS, showCents)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{t('month_hero.upcoming_empty')}</p>
        )}
      </div>
    </section>
    </Card>
  )
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthAbbrev = (iso: string): string => {
  const m = Number(iso.split('-')[1])
  return MONTHS_ES[m - 1] ?? ''
}
