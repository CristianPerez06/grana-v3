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
 * Statement-lifecycle stepper: Pagado → [A pagar] → En curso → Próximo.
 * The "A pagar" step only appears when that statement exists; every step
 * except "Pagado" selects the period shown below. Renders a horizontal
 * stepper at md+ and a vertical rail (inside a `Ciclo del resumen` card) on
 * narrow widths so users never need to scroll sideways through the cycle.
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
    <>
      {/* Desktop / wide: horizontal stepper */}
      <nav
        className="hidden items-start gap-2 overflow-x-auto rounded-2xl border border-border-soft bg-card p-4 md:flex"
        aria-label={t('detail.timeline_rail_title')}
      >
        {steps.map((step, i) => {
          const isActive = step.key === active
          const dotColor = step.key === '_pagado' ? 'var(--emerald)' : step.color
          const content = (
            <div className="flex min-w-[86px] flex-col gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: dotColor,
                  boxShadow: isActive
                    ? `0 0 0 3px color-mix(in srgb, ${dotColor} 25%, transparent)`
                    : undefined,
                }}
                aria-hidden
              />
              <span className="text-xs font-extrabold" style={{ color: step.color }}>
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
                  style={{
                    backgroundColor: i === 0 && hasPaid ? 'var(--emerald)' : 'var(--border)',
                  }}
                  aria-hidden
                />
              )}
            </div>
          )
        })}
      </nav>

      {/* Narrow: vertical rail inside a "Ciclo del resumen" card */}
      <nav
        className="rounded-2xl border border-border-soft bg-card p-4 md:hidden"
        aria-label={t('detail.timeline_rail_title')}
      >
        <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-text-soft">
          {t('detail.timeline_rail_title')}
        </p>
        <div className="flex flex-col">
          {steps.map((step, i) => {
            const isActive = step.key === active
            const dotColor = step.key === '_pagado' ? 'var(--emerald)' : step.color
            const isLast = i === steps.length - 1
            const innerContent = (
              <>
                <span className="relative z-10 h-3 w-3 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <strong className="truncate text-sm text-text" style={{ color: step.color }}>
                    {step.label}
                  </strong>
                  {step.date && (
                    <span className="shrink-0 text-xs text-text-muted">{step.date}</span>
                  )}
                </div>
              </>
            )
            const className =
              'relative grid min-h-[48px] grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald'
            const activeBg = isActive ? 'bg-terracotta-soft' : ''
            const connector = !isLast ? (
              <span
                className="absolute left-[15px] top-[30px] bottom-[-18px] w-0.5 rounded-full bg-border"
                aria-hidden
              />
            ) : null

            if (step.selectable) {
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => onSelect(step.key as PeriodKey)}
                  className={`${className} ${activeBg}`}
                >
                  {innerContent}
                  {connector}
                </button>
              )
            }
            return (
              <div key={step.key} className={`${className} ${activeBg}`}>
                {innerContent}
                {connector}
              </div>
            )
          })}
        </div>
      </nav>
    </>
  )
}
