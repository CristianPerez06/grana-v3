'use client'

import { useTranslations } from 'next-intl'
import type { PeriodKey } from './card-detail-types'
import { formatDayMonth } from './card-presentation'

type Props = {
  hasApagar: boolean
  /** Whether at least one paid statement exists (shows the "Pagado" step). */
  hasPaid: boolean
  cursoCloseDate: string | null
  apagarDueDate: string | null
  proxCloseDate: string | null
  active: PeriodKey
  accent: string
  onSelect: (period: PeriodKey) => void
}

type Step = {
  key: PeriodKey | '_pagado'
  label: string
  date: string
  color: string
  selectable: boolean
}

/**
 * Horizontal statement-lifecycle stepper: Pagado → [A pagar] → En curso →
 * Próximo. The "A pagar" step only appears when that statement exists. Every
 * step except "Pagado" is clickable and selects the period shown below.
 */
export const LifecycleTimeline = ({
  hasApagar,
  hasPaid,
  cursoCloseDate,
  apagarDueDate,
  proxCloseDate,
  active,
  accent,
  onSelect,
}: Props) => {
  const t = useTranslations('cards')

  const steps: Step[] = []
  if (hasPaid) {
    steps.push({
      key: '_pagado',
      label: t('detail.timeline_paid'),
      date: '',
      color: 'var(--emerald-deep)',
      selectable: false,
    })
  }
  if (hasApagar) {
    steps.push({
      key: 'apagar',
      label: t('detail.timeline_apagar'),
      date: t('detail.timeline_due', { date: formatDayMonth(apagarDueDate) }),
      color: 'var(--terracotta)',
      selectable: true,
    })
  }
  steps.push({
    key: 'curso',
    label: t('detail.timeline_curso'),
    date: t('detail.timeline_close', { date: formatDayMonth(cursoCloseDate) }),
    color: accent,
    selectable: true,
  })
  if (proxCloseDate) {
    steps.push({
      key: 'prox',
      label: t('detail.timeline_prox'),
      date: t('detail.timeline_close', { date: formatDayMonth(proxCloseDate) }),
      color: 'var(--text-muted)',
      selectable: true,
    })
  }

  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const isActive = step.key === active
        const dotColor = step.key === '_pagado' ? 'var(--emerald)' : step.color
        const content = (
          <div className="flex flex-col gap-1.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: dotColor,
                boxShadow: isActive ? `0 0 0 3px color-mix(in srgb, ${dotColor} 25%, transparent)` : undefined,
              }}
              aria-hidden
            />
            <span
              className="text-xs font-bold"
              style={{ color: step.color }}
            >
              {step.label}
            </span>
            {step.date && <span className="text-[11px] text-text-soft">{step.date}</span>}
          </div>
        )
        return (
          <div key={step.key} className="flex shrink-0 items-start gap-2">
            {step.selectable ? (
              <button
                type="button"
                onClick={() => onSelect(step.key as PeriodKey)}
                className="rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald"
              >
                {content}
              </button>
            ) : (
              content
            )}
            {i < steps.length - 1 && (
              <span
                className="mt-1.5 h-0.5 w-10 shrink-0 rounded-full"
                style={{ backgroundColor: i === 0 && hasPaid ? 'var(--emerald)' : 'var(--border)' }}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
