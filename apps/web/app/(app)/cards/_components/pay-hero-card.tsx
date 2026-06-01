'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { LifecyclePeriod } from './card-detail-types'
import { formatDayMonth } from './card-presentation'

type Props = {
  cardId: string
  period: LifecyclePeriod
  daysToDue: number
  selected: boolean
  showCents?: boolean
  onSelect: () => void
}

/**
 * Terracota hero for the statement that must be paid: big ARS amount (USD
 * subordinate and separate), close/due dates, a countdown, and the
 * "Registrar pago" CTA. The whole card selects the `apagar` period; the CTA
 * stops propagation so it navigates to the payment flow instead.
 */
export const PayHeroCard = ({
  cardId,
  period,
  daysToDue,
  selected,
  showCents = false,
  onSelect,
}: Props) => {
  const t = useTranslations('cards')
  const overdue = daysToDue < 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[20px] border border-[#EEDAD2] bg-gradient-to-b from-[#FBF1ED] to-card p-7 text-left outline-none transition-shadow"
      style={selected ? { boxShadow: 'inset 0 0 0 2px var(--terracotta)' } : undefined}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-terracotta">
            <AlertTriangle size={14} />
            {t('detail.pay_eyebrow')}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[56px] font-extrabold leading-none tracking-[-0.045em] tabular-nums">
              {formatARS(period.pendingAmountARS, showCents)}
            </span>
            {period.pendingAmountUSD > 0 && (
              <span className="text-lg font-bold text-text-muted tabular-nums">
                + {formatUSD(period.pendingAmountUSD, showCents)}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            {t.rich('detail.pay_sub', {
              close: formatDayMonth(period.end_date),
              due: formatDayMonth(period.due_date),
              b: (chunks) => <b className="font-semibold text-text">{chunks}</b>,
            })}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <div className="flex flex-col md:items-end">
            {overdue ? (
              <span className="text-sm font-bold text-terracotta">
                {t('detail.pay_overdue', { days: Math.abs(daysToDue) })}
              </span>
            ) : (
              <>
                <span className="text-3xl font-extrabold leading-none tabular-nums text-terracotta">
                  {daysToDue}
                </span>
                <span className="text-xs text-text-muted">{t('detail.pay_countdown')}</span>
              </>
            )}
          </div>
          <Link
            href={`/cards/${cardId}/periods/${period.id}/pay`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center rounded-xl bg-terracotta px-7 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {t('detail.pay_cta')}
          </Link>
        </div>
      </div>
    </button>
  )
}
