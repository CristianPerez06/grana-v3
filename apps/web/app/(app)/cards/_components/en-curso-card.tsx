'use client'

import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import type { LifecyclePeriod } from './card-detail-types'
import { formatDayMonth } from './card-presentation'

type Props = {
  period: LifecyclePeriod
  /** Hero treatment (bigger amount + accent ring) when there is no "a pagar". */
  isHero: boolean
  selected: boolean
  accent: string
  cycleDay: number
  cycleTotal: number
  daysToClose: number
  movementsCount: number
  installmentsARS: number
  showCents?: boolean
  onSelect: () => void
}

/**
 * "En curso" statement card: live badge, accumulated amount (includes the
 * cycle's installments), movement/installment stats, and a cycle panel
 * (closes, days left, progress bar, day X of N). Becomes the hero when there
 * is no "a pagar" statement.
 */
export const EnCursoCard = ({
  period,
  isHero,
  selected,
  accent,
  cycleDay,
  cycleTotal,
  daysToClose,
  movementsCount,
  installmentsARS,
  showCents = false,
  onSelect,
}: Props) => {
  const t = useTranslations('cards')
  const cyclePct = cycleTotal > 0 ? Math.min(100, Math.round((cycleDay / cycleTotal) * 100)) : 0
  const hasInstallments = installmentsARS > 0

  return (
    <Card asChild>
    <button
      type="button"
      onClick={onSelect}
      className="w-full p-7 text-left outline-none transition-shadow"
      style={selected || isHero ? { boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_290px] md:items-center">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="text-xs font-extrabold uppercase tracking-[0.12em]"
              style={{ color: accent }}
            >
              {t('detail.curso_eyebrow')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-deep">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              {t('detail.curso_live')}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`font-extrabold leading-none tracking-[-0.04em] tabular-nums ${isHero ? 'text-[52px]' : 'text-[40px]'}`}
            >
              {formatARS(period.pendingAmountARS, showCents)}
            </span>
            {period.pendingAmountUSD > 0 && (
              <span className="text-base font-bold text-text-muted tabular-nums">
                + {formatUSD(period.pendingAmountUSD, showCents)}
              </span>
            )}
          </div>

          <p className="text-sm text-text-muted">
            {hasInstallments
              ? t('detail.curso_accumulated_installments')
              : t('detail.curso_accumulated')}
          </p>

          <div className="flex gap-6 pt-1">
            <div>
              <p className="text-lg font-extrabold tabular-nums">{movementsCount}</p>
              <p className="text-xs text-text-muted">{t('detail.curso_movements', { count: movementsCount })}</p>
            </div>
            {hasInstallments && (
              <div>
                <p className="text-lg font-extrabold tabular-nums">{formatARS(installmentsARS, showCents)}</p>
                <p className="text-xs text-text-muted">{t('detail.curso_in_installments')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cycle panel */}
        <div className="flex flex-col gap-2 rounded-2xl bg-border-soft/60 p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('detail.cycle_close')}
          </p>
          <p className="text-xl font-extrabold tabular-nums">{formatDayMonth(period.end_date)}</p>
          <p className="text-[13px] font-semibold" style={{ color: accent }}>
            {t('detail.cycle_in_days', { days: daysToClose })}
          </p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{ width: `${cyclePct}%`, backgroundColor: accent }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{t('detail.cycle_day', { day: cycleDay })}</span>
            <span>{t('detail.cycle_total', { total: cycleTotal })}</span>
          </div>
        </div>
      </div>
    </button>
    </Card>
  )
}
