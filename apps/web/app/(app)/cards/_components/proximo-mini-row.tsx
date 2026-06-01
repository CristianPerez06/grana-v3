'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import type { LifecyclePeriod } from './card-detail-types'
import { formatDayMonth } from './card-presentation'

type Props = {
  period: LifecyclePeriod
  selected: boolean
  accent: string
  showCents?: boolean
  onSelect: () => void
}

/** Dashed mini-row for the "próximo" statement (already committed in installments). */
export const ProximoMiniRow = ({ period, selected, accent, showCents = false, onSelect }: Props) => {
  const t = useTranslations('cards')
  const isZero = period.pendingAmountARS === 0 && period.pendingAmountUSD === 0
  const note = isZero ? t('detail.prox_note_empty') : t('detail.prox_note_installments')

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-border px-5 py-4 text-left outline-none transition-colors hover:bg-border-soft/40"
      style={selected ? { borderStyle: 'solid', boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}
    >
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-soft">
        {t('detail.prox_label')}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
        {t('detail.prox_info', { date: formatDayMonth(period.end_date), note })}
      </span>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${isZero ? 'text-text-soft' : ''}`}>
        {formatARS(period.pendingAmountARS, showCents)}
      </span>
      <ChevronRight size={18} className="shrink-0 text-text-soft" />
    </button>
  )
}
