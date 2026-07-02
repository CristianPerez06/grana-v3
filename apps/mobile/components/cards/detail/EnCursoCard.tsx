import { Pressable, Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { LifecyclePeriod } from '@grana/cards'
import { formatDayMonth } from '@grana/cards'
import { useT } from '../../../lib/locale-context'

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
 * "En curso" statement card: live badge, accumulated amount (includes the cycle's
 * installments), movement/installment stats, and a cycle panel (progress bar, day
 * X, close date, days left). Becomes the hero when there is no "a pagar".
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
  const t = useT()
  const cyclePct = cycleTotal > 0 ? Math.min(100, Math.round((cycleDay / cycleTotal) * 100)) : 0
  const hasInstallments = installmentsARS > 0
  const ringed = selected || isHero

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      className="rounded-2xl border border-border-soft bg-card p-5"
      style={ringed ? { borderColor: accent, borderWidth: 2 } : undefined}
    >
      <View className="flex-row flex-wrap items-center gap-3">
        <Text className="text-xs font-extrabold uppercase tracking-wider" style={{ color: accent }}>
          {t('cards.detail.curso_eyebrow')}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-emerald" />
          <Text className="text-xs font-semibold text-emerald-deep">{t('cards.detail.curso_live')}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
        <Text className={`font-extrabold tracking-tight text-text ${isHero ? 'text-5xl' : 'text-4xl'}`}>
          {formatARS(period.pendingAmountARS, showCents)}
        </Text>
        {period.pendingAmountUSD > 0 && (
          <Text className="text-base font-bold text-text-muted">
            + {formatUSD(period.pendingAmountUSD, showCents)}
          </Text>
        )}
      </View>

      <Text className="mt-2 text-sm text-text-muted">
        {hasInstallments
          ? t('cards.detail.curso_accumulated_installments')
          : t('cards.detail.curso_accumulated')}
      </Text>

      <View className="mt-3 flex-row gap-6">
        <View>
          <Text className="text-lg font-extrabold text-text">{movementsCount}</Text>
          <Text className="text-xs text-text-muted">
            {t('cards.detail.curso_movements', { count: movementsCount })}
          </Text>
        </View>
        {hasInstallments && (
          <View>
            <Text className="text-lg font-extrabold text-text">{formatARS(installmentsARS, showCents)}</Text>
            <Text className="text-xs text-text-muted">{t('cards.detail.curso_in_installments')}</Text>
          </View>
        )}
      </View>

      <View className="mt-4 flex-row items-center gap-4 rounded-2xl bg-border-soft p-4">
        <View className="flex-1">
          <View className="h-2 w-full overflow-hidden rounded-full bg-border">
            <View className="h-full rounded-full" style={{ width: `${cyclePct}%`, backgroundColor: accent }} />
          </View>
          <Text className="mt-1.5 text-xs text-text-muted">{t('cards.detail.cycle_day', { day: cycleDay })}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('cards.detail.cycle_close')}
            {period.is_estimated ? ` (${t('cards.detail.timeline_estimated_tag')})` : ''}
          </Text>
          <Text className="text-base font-extrabold text-text">
            {period.is_estimated ? '~' : ''}
            {formatDayMonth(period.end_date)}
          </Text>
          <Text className="text-[13px] font-semibold" style={{ color: accent }}>
            {t('cards.detail.cycle_in_days', { days: daysToClose })}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
