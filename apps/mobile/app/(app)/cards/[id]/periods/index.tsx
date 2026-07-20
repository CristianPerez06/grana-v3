import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CardPeriodDetail } from '@grana/cards'
import { getCardPeriods } from '../../../../../lib/cards/queries'
import { useShowCents } from '../../../../../lib/preferences-context'
import { useT } from '../../../../../lib/locale-context'
import { PageHeader } from '../../../../../components/ui/PageHeader'
import { Spinner } from '../../../../../components/ui/Spinner'
import { PeriodStatusPill } from '../../../../../components/cards/PeriodStatusPill'

// Compact `dd/mm/yy` — statements can span years, so the list carries the year.
const fmt = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/**
 * Periods list — every statement of a card (thin consumer of `getCardPeriods`).
 * One row per period: date range · status pill · "estimada" badge · due line ·
 * ARS amount (+ subordinated USD). Tapping a row opens its statement detail.
 */
export default function CardPeriodsScreen() {
  const t = useT()
  const router = useRouter()
  const showCents = useShowCents()
  const { id } = useLocalSearchParams<{ id: string }>()

  const query = useQuery({
    queryKey: ['cards', 'periods', id] as const,
    queryFn: () => getCardPeriods(id),
  })

  const periods = query.data ?? []

  const openPeriod = (periodId: string) =>
    router.push({
      pathname: '/(app)/cards/[id]/periods/[periodId]',
      params: { id, periodId },
    })

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('cards.list.periods_title')}
        backLink={{ href: '/(app)/cards/[id]', label: t('cards.back_label') }}
        onBackPress={() => router.back()}
      />
      <ScrollView contentContainerClassName="px-6 py-6">
        {query.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : periods.length === 0 ? (
          <Text className="py-8 text-center text-sm text-text-muted">
            {t('cards.list.periods_empty')}
          </Text>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            {periods.map((period, index) => (
              <PeriodRow
                key={period.id}
                period={period}
                showCents={showCents}
                first={index === 0}
                onPress={() => openPeriod(period.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function PeriodRow({
  period,
  showCents,
  first,
  onPress,
}: {
  period: CardPeriodDetail
  showCents: boolean
  first: boolean
  onPress: () => void
}) {
  const t = useT()
  const totalARS = period.has_payment ? period.paidAmountARS : period.pendingAmountARS
  const totalUSD = period.has_payment ? period.paidAmountUSD : period.pendingAmountUSD

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-border-soft ${
        first ? '' : 'border-t border-border-soft'
      }`}
    >
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-text-muted">
            {fmt(period.start_date)} – {fmt(period.end_date)}
          </Text>
          <PeriodStatusPill variant={period.variant} />
          {period.is_estimated && (
            <Text className="text-[11px] text-text-soft">{t('cards.period.estimated_badge')}</Text>
          )}
        </View>
        <Text className="mt-0.5 text-xs text-text-muted">
          {t('cards.period.due_prefix')} {fmt(period.due_date)}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-semibold tabular-nums text-text">
          {formatARS(totalARS, showCents)}
        </Text>
        {totalUSD > 0 && (
          <Text className="text-xs tabular-nums text-text-muted">
            {formatUSD(totalUSD, showCents)}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
