import { Pressable, Text, View } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { LifecyclePeriod } from '@grana/cards'
import { formatDayMonth } from '@grana/cards'
import { useT } from '../../../lib/locale-context'
import { detailColors, stripBold } from './format'

type Props = {
  period: LifecyclePeriod
  daysToDue: number
  selected: boolean
  showCents?: boolean
  onSelect: () => void
  /** Present ⇒ renders the "Pagar resumen" CTA that opens the pay flow. */
  onPay?: () => void
}

/**
 * Terracota hero for the statement that must be paid: the big ARS amount (USD
 * subordinate), close/due dates and the countdown. Tapping the body selects the
 * period; the "Pagar resumen" CTA (when `onPay` is passed) opens the pay flow.
 */
export const PayHeroCard = ({
  period,
  daysToDue,
  selected,
  showCents = false,
  onSelect,
  onPay,
}: Props) => {
  const t = useT()
  const overdue = daysToDue < 0

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      className="rounded-[20px] border bg-terracotta-soft p-5"
      style={{ borderColor: selected ? detailColors.terracotta : 'transparent' }}
    >
      <View className="flex-row items-center gap-1.5">
        <AlertTriangle size={14} color={detailColors.terracotta} />
        <Text className="text-[11px] font-extrabold uppercase tracking-wider text-terracotta">
          {t('cards.detail.pay_eyebrow')}
        </Text>
      </View>

      <View className="mt-2 flex-row flex-wrap items-baseline gap-2">
        <Text className="text-4xl font-extrabold tracking-tight text-text">
          {formatARS(period.pendingAmountARS, showCents)}
        </Text>
        {period.pendingAmountUSD > 0 && (
          <Text className="text-lg font-bold text-text-muted">
            + {formatUSD(period.pendingAmountUSD, showCents)}
          </Text>
        )}
      </View>

      <Text className="mt-1 text-sm text-text-muted">
        {stripBold(
          t('cards.detail.pay_sub', {
            close: formatDayMonth(period.end_date),
            due: formatDayMonth(period.due_date),
          }),
        )}
      </Text>

      <View className="mt-3 flex-row items-baseline gap-1.5">
        {overdue ? (
          <Text className="text-sm font-bold text-terracotta">
            {t('cards.detail.pay_overdue', { days: Math.abs(daysToDue) })}
          </Text>
        ) : (
          <>
            <Text className="text-2xl font-extrabold text-terracotta">{daysToDue}</Text>
            <Text className="text-xs text-text-muted">{t('cards.detail.pay_countdown')}</Text>
          </>
        )}
      </View>

      {onPay && (
        <Pressable
          onPress={onPay}
          accessibilityRole="button"
          className="mt-4 w-full items-center justify-center rounded-xl py-3"
          style={{ backgroundColor: detailColors.terracotta }}
        >
          <Text className="text-base font-semibold text-white">
            {t('cards.actions.pay_statement')}
          </Text>
        </Pressable>
      )}
    </Pressable>
  )
}
