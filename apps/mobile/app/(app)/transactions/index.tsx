import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Repeat } from 'lucide-react-native'
import { getTodayAR, formatDateISO } from '@grana/money-logic'
import { DEFAULT_MOVEMENTS_LIMIT, monthOf, shiftMonth } from '@grana/transactions'
import { PageHeader } from '../../../components/ui/PageHeader'
import { MonthNavigator } from '../../../components/ui/MonthNavigator'
import { MovementList } from '../../../components/movements/MovementList'
import { MovementListSkeleton } from '../../../components/movements/MovementListSkeleton'
import { QuickAddFab } from '../../../components/transactions/QuickAddFab'
import { PendingRecurrencesBlock } from '../../../components/recurrences/PendingRecurrencesBlock'
import { PendingReimbursementsBlock } from '../../../components/transactions/PendingReimbursementsBlock'
import { RecurrenceSuggestionBanner } from '../../../components/recurrences/RecurrenceSuggestionBanner'
import { getMovementsFeedPage, hasAnyTransaction } from '../../../lib/transactions/queries'
import { useLocale, useT } from '../../../lib/locale-context'
import { colors } from '../../../lib/colors'
import type { Locale } from '../../../lib/locale'

// Hermes has no full `Intl`, so the month-year label for the empty-state copy is
// composed from a hand-rolled table (same approach as MovementList / the accounts
// rows). The MonthNavigator renders its own Spanish label above the list.
const MONTHS: Record<Locale, readonly string[]> = {
  es: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

/** Absolute month index for bounds math (`YYYY-MM` → year*12 + monthIndex). */
const monthIndex = (month: string): number => {
  const [y, m] = month.split('-').map(Number)
  return y * 12 + (m - 1)
}

const HISTORY_MONTHS_BACK = 12

// Global Movimientos feed: month-navigable list + load more, reusing the shared
// read (`getMovementsFeedPage`) and the native MovementList. The QuickAddFab opens
// the create form; tapping a row opens the movement detail (`/transactions/[txId]`).
export default function MovimientosScreen() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  const todayISO = formatDateISO(getTodayAR())
  const currentMonth = monthOf(getTodayAR())

  const [month, setMonth] = useState(currentMonth)
  const [limit, setLimit] = useState(DEFAULT_MOVEMENTS_LIMIT)

  const goToMonth = (next: string) => {
    setMonth(next)
    setLimit(DEFAULT_MOVEMENTS_LIMIT)
  }

  const monthsBack = monthIndex(currentMonth) - monthIndex(month)
  const canGoBack = monthsBack < HISTORY_MONTHS_BACK
  const canGoForward = monthsBack > 0
  const [year, monthNum] = month.split('-').map(Number)

  const feedQuery = useQuery({
    queryKey: ['transactions', 'feed', { month, limit }] as const,
    queryFn: () => getMovementsFeedPage(month, limit),
  })

  const movements = feedQuery.data?.movements ?? []
  const isEmpty = feedQuery.isSuccess && movements.length === 0

  // Only needed to pick the empty-state variant (welcome vs. month-empty).
  const hasAnyQuery = useQuery({
    queryKey: ['transactions', 'has-any'] as const,
    queryFn: hasAnyTransaction,
    enabled: isEmpty,
  })

  const monthLabel = `${MONTHS[locale][monthNum - 1]} ${year}`
  const emptyState = isEmpty
    ? hasAnyQuery.data === false
      ? {
          title: t('transactions.empty.welcome.title'),
          body: t('transactions.empty.welcome.body'),
        }
      : {
          title: t('transactions.empty.month.title', { month: monthLabel }),
          body: t('transactions.empty.month.body'),
        }
    : undefined

  // The rows/skeleton sit on a `bg-card` surface (mirror of the card pane and
  // the account detail), which the pale skeleton blocks need for contrast. The
  // empty state renders bare — MovementList draws its own dashed-border card, so
  // wrapping it here would nest a card in a card.
  const list = (
    <MovementList
      movements={movements}
      perspective={{ kind: 'global' }}
      todayISO={todayISO}
      emptyState={emptyState}
      showAccount
      showFeedBadges
      onPressMovement={(m) => router.push(`/transactions/${m.id}`)}
    />
  )

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('nav.movements')}
        actions={
          <Pressable
            onPress={() => router.push('/transactions/recurring')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('recurrences.title')}
            className="h-9 w-9 items-center justify-center rounded-lg"
          >
            <Repeat size={20} color={colors.white} />
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-28">
        <MonthNavigator
          year={year}
          month={monthNum}
          onPrev={canGoBack ? () => goToMonth(shiftMonth(month, -1)) : undefined}
          onNext={canGoForward ? () => goToMonth(shiftMonth(month, +1)) : undefined}
        />

        <PendingRecurrencesBlock />
        <PendingReimbursementsBlock todayISO={todayISO} />
        <RecurrenceSuggestionBanner />

        {feedQuery.isPending ? (
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <MovementListSkeleton />
          </View>
        ) : feedQuery.isError ? (
          <View className="rounded-[20px] border border-dashed border-border p-8">
            <Text className="text-center text-sm text-text-muted">
              {t('transactions.route.feed_error')}
            </Text>
          </View>
        ) : (
          <>
            {movements.length === 0 ? (
              list
            ) : (
              <View className="overflow-hidden rounded-2xl border border-border bg-card">
                {list}
              </View>
            )}
            {feedQuery.data?.hasMore && (
              <Pressable
                onPress={() => setLimit(feedQuery.data.nextLimit)}
                className="items-center rounded-xl border border-border bg-card py-3"
              >
                <Text className="text-sm font-semibold text-text">
                  {t('common.load_more')}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      <QuickAddFab />
    </View>
  )
}
