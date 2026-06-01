import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  buildCategorySlices,
  type CategorySlice,
} from '@grana/money-logic'
import { UNCATEGORIZED_ID } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { useMonthCategoryBreakdown } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

type Props = {
  today: Date
}

const FALLBACK_BAR_COLOR = '#9CA3AF'

// Stable height for the swap region while loading/error. The teaser is short
// (≤3 short rows), so this bounds the placeholder states, not the data state.
const SWAP_MIN_HEIGHT = 96

// Tap target padding for the "Ver desglose" link. The text itself is small
// (~12px font); 12pt of hitSlop on each side brings the effective target to
// ~44pt without enlarging the visual chrome.
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

type RowProps = {
  slice: CategorySlice
}

const Row = ({ slice }: RowProps) => (
  <View className="flex-row items-center gap-2">
    <Text className="min-w-0 flex-1 text-sm text-text" numberOfLines={1}>
      {slice.icon ? `${slice.icon} ` : ''}
      {slice.label}
    </Text>
    <View className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border-soft">
      <View
        className="h-full rounded-full"
        style={{
          width: `${slice.percentage}%`,
          backgroundColor: slice.color ?? FALLBACK_BAR_COLOR,
        }}
      />
    </View>
    <Text className="w-9 shrink-0 text-right text-xs text-text-muted">
      {Math.round(slice.percentage)}%
    </Text>
  </View>
)

export const CategoryTeaser = ({ today }: Props) => {
  const t = useT()
  const router = useRouter()
  const query = useMonthCategoryBreakdown(today)
  const data = query.data

  // Empty month → the section disappears entirely, matching web. The user sees
  // it the moment they have ≥1 categorised expense.
  if (data) {
    const slices = buildCategorySlices(
      data.ARS.map((i) =>
        i.categoryId === UNCATEGORIZED_ID
          ? { ...i, label: t('transactions.spending.uncategorized') }
          : i,
      ),
      { topN: 3, othersLabel: t('transactions.spending.others') },
    ).slices.slice(0, 3)

    if (slices.length === 0) return null

    return (
      <View className="rounded-2xl border border-border bg-card p-6">
        <View className="mb-4 flex-row items-center justify-between gap-2">
          <Text className="text-lg font-semibold text-text">
            {t('dashboard.spending.title')}
          </Text>
          {/* Only the link navigates (parity with web's `<Link>`). The card body
              is not pressable. `hitSlop` expands the touch target without
              changing the visual.
              Transitional destination: mobile `/transactions` is a list-only
              stub today (no donut yet); the link is still labelled "Ver
              desglose" because the donut will land at that route. */}
          <Pressable
            onPress={() => router.push('/transactions')}
            hitSlop={LINK_HIT_SLOP}
            accessibilityRole="link"
          >
            <Text className="text-xs font-medium text-primary">
              {t('dashboard.spending.view_all')}
            </Text>
          </Pressable>
        </View>

        <View className="flex-col gap-2">
          {slices.map((s) => (
            <Row key={s.categoryId ?? `slice-${s.label}`} slice={s} />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-center justify-between gap-2">
        <Text className="text-lg font-semibold text-text">
          {t('dashboard.spending.title')}
        </Text>
      </View>
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
        ) : (
          <View className="items-center justify-center">
            <Spinner size="lg" />
          </View>
        )}
      </View>
    </View>
  )
}
