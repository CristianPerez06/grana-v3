import { Pressable, Text, View } from 'react-native'
import type { PeriodKey } from '@grana/cards'
import { formatDayMonth } from '@grana/cards'
import { useT } from '../../../lib/locale-context'
import { detailColors } from './format'

type Props = {
  hasApagar: boolean
  hasPaid: boolean
  cursoCloseDate: string | null
  cursoIsEstimated?: boolean
  apagarDueDate: string | null
  proxCloseDate: string | null
  proxIsEstimated?: boolean
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
  estimated?: boolean
}

/**
 * Native statement-lifecycle rail: Pagado → [A pagar] → En curso → Próximo, as a
 * vertical stepper inside a "Ciclo del resumen" card (mirrors the web narrow-width
 * variant). Every step except "Pagado" selects the statement shown below.
 */
export const LifecycleTimeline = ({
  hasApagar,
  hasPaid,
  cursoCloseDate,
  cursoIsEstimated = false,
  apagarDueDate,
  proxCloseDate,
  proxIsEstimated = false,
  active,
  accent,
  onSelect,
}: Props) => {
  const t = useT()

  const steps: Step[] = []
  if (hasPaid) {
    steps.push({
      key: '_pagado',
      label: t('cards.detail.timeline_paid'),
      date: '',
      color: detailColors.emerald,
      selectable: false,
    })
  }
  if (hasApagar) {
    steps.push({
      key: 'apagar',
      label: t('cards.detail.timeline_apagar'),
      date: t('cards.detail.timeline_due', { date: formatDayMonth(apagarDueDate) }),
      color: detailColors.terracotta,
      selectable: true,
    })
  }
  steps.push({
    key: 'curso',
    label: t('cards.detail.timeline_curso'),
    date: t(cursoIsEstimated ? 'cards.detail.timeline_close_estimated' : 'cards.detail.timeline_close', {
      date: formatDayMonth(cursoCloseDate),
    }),
    color: accent,
    selectable: true,
    estimated: cursoIsEstimated,
  })
  if (proxCloseDate) {
    steps.push({
      key: 'prox',
      label: t('cards.detail.timeline_prox'),
      date: t(proxIsEstimated ? 'cards.detail.timeline_close_estimated' : 'cards.detail.timeline_close', {
        date: formatDayMonth(proxCloseDate),
      }),
      color: detailColors.textMuted,
      selectable: true,
      estimated: proxIsEstimated,
    })
  }

  return (
    <View className="rounded-2xl border border-border-soft bg-card p-4">
      <Text className="mb-2.5 text-[11px] font-extrabold uppercase tracking-wider text-text-soft">
        {t('cards.detail.timeline_rail_title')}
      </Text>
      <View className="flex-col">
        {steps.map((step, i) => {
          const isActive = step.key === active
          const isLast = i === steps.length - 1

          const inner = (
            <View
              className={`flex-1 flex-row items-start justify-between gap-3 rounded-xl px-2 py-1.5 ${
                isActive ? 'bg-terracotta-soft' : ''
              }`}
            >
              <Text className="text-sm font-bold" style={{ color: step.color }}>
                {step.label}
              </Text>
              {!!step.date && (
                <View className="shrink-0 items-end">
                  <Text className="text-xs text-text-muted">{step.date}</Text>
                  {step.estimated && (
                    <Text className="text-[10px] font-semibold italic text-text-soft">
                      ({t('cards.detail.timeline_estimated_tag')})
                    </Text>
                  )}
                </View>
              )}
            </View>
          )

          return (
            <View key={step.key} className="flex-row items-stretch gap-2.5">
              <View className="items-center pt-2">
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: step.color }} />
                {!isLast && (
                  <View
                    className="my-1 w-0.5 flex-1 rounded-full"
                    style={{ backgroundColor: detailColors.border }}
                  />
                )}
              </View>
              {step.selectable ? (
                <Pressable
                  onPress={() => onSelect(step.key as PeriodKey)}
                  accessibilityRole="button"
                  className="flex-1 pb-1"
                >
                  {inner}
                </Pressable>
              ) : (
                <View className="flex-1 pb-1">{inner}</View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}
