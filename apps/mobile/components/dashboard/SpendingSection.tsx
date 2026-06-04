import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  buildCategorySlices,
  type CategorySliceInput,
} from '@grana/money-logic'
import { UNCATEGORIZED_ID } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { useMonthCategoryBreakdown } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { useDashboardMonth } from './DashboardMonthContext'
import { MaskedAmount } from './MaskedAmount'
import { SpendingDonut, sliceColor } from './SpendingDonut'
import { SpendingSkeleton } from './SpendingSkeleton'

// The handoff shows 5 named slices; the tail aggregates into "Otros".
const TOP_N = 5

// Donut + legend keep the card a stable size while loading/error replace them.
const SWAP_MIN_HEIGHT = 320

// ~44pt effective tap target for the small "Ver desglose" link.
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

type Currency = 'ARS' | 'USD'

// "En qué se fue" — month spending by category: SVG donut + legend with
// amounts, ARS/USD segmented toggle (both currencies arrive in one payload, so
// toggling never refetches). Follows the header's shared month selection.
export const SpendingSection = () => {
  const t = useT()
  const router = useRouter()
  const { selected } = useDashboardMonth()
  const [currency, setCurrency] = useState<Currency>('ARS')

  const query = useMonthCategoryBreakdown(selected.year, selected.month)
  const data = query.data

  // Relabel (uncategorized sentinel + system categories) before slicing, same
  // as the Movimientos breakdown, so both screens speak identical labels.
  const breakdown = useMemo(() => {
    if (!data) return null
    const relabel = (inputs: CategorySliceInput[]): CategorySliceInput[] =>
      inputs.map((i) =>
        i.categoryId === UNCATEGORIZED_ID
          ? { ...i, label: t('transactions.spending.uncategorized') }
          : i.isSystem && i.canonicalName
            ? { ...i, label: t(`categories.${i.canonicalName}`) }
            : i,
      )
    return buildCategorySlices(relabel(data[currency]), {
      topN: TOP_N,
      othersLabel: t('transactions.spending.others'),
    })
  }, [data, currency, t])

  const goToBreakdown = () => router.push('/transactions')

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="flex-shrink text-lg font-semibold text-text">
          {t('dashboard.spending.title')}
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={goToBreakdown} accessibilityRole="link" hitSlop={LINK_HIT_SLOP}>
            <Text className="text-[13px] font-bold text-emerald-deep">
              {t('dashboard.spending.view_all')}
            </Text>
          </Pressable>
          <View className="w-32">
            <Segmented
              value={currency}
              onValueChange={(next) => setCurrency(next as Currency)}
              options={[
                { value: 'ARS', label: 'ARS' },
                { value: 'USD', label: 'USD' },
              ]}
              ariaLabel={t('dashboard.spending.title')}
            />
          </View>
        </View>
      </View>

      {/* Swappable region with a stable minimum height (no layout shift). */}
      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.spending.error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : breakdown === null ? (
          <SpendingSkeleton />
        ) : breakdown.slices.length === 0 ? (
          <View className="items-center justify-center px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.spending.empty')}
            </Text>
          </View>
        ) : (
          <View className="items-center gap-6">
            <SpendingDonut
              slices={breakdown.slices}
              total={breakdown.total}
              currency={currency}
              centerLabel={t('dashboard.spending.center_label')}
            />
            <View className="w-full gap-3">
              {breakdown.slices.map((slice, index) => (
                <Pressable
                  key={slice.categoryId ?? `otros-${index}`}
                  onPress={goToBreakdown}
                  accessibilityRole="link"
                  className="flex-row items-center gap-2.5"
                >
                  <View
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ backgroundColor: sliceColor(slice, index) }}
                  />
                  <Text
                    className="min-w-0 flex-1 text-sm font-bold text-text"
                    numberOfLines={1}
                  >
                    {slice.label}
                  </Text>
                  <MaskedAmount
                    amount={slice.value}
                    currency={currency}
                    className="text-sm font-extrabold text-text"
                  />
                  <Text className="w-[34px] text-right text-xs font-bold text-text-soft">
                    {Math.round(slice.percentage)}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
