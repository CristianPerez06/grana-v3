import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import {
  KEYBOARD_BOTTOM_OFFSET,
  KeyboardAwareScrollView,
} from '../../../components/layout/keyboard-aware-scroll-view'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Repeat, Search, SlidersHorizontal, X } from 'lucide-react-native'
import { getTodayAR, formatDateISO } from '@grana/money-logic'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { DEFAULT_MOVEMENTS_LIMIT, monthOf, shiftMonth } from '@grana/transactions'
import { PageHeader } from '../../../components/ui/PageHeader'
import { MonthNavigator } from '../../../components/ui/MonthNavigator'
import { MovementList } from '../../../components/movements/MovementList'
import { MovementListSkeleton } from '../../../components/movements/MovementListSkeleton'
import {
  ActiveFilterChips,
  type ActiveFilterChip,
} from '../../../components/movements/ActiveFilterChips'
import { MovementFiltersSheet } from '../../../components/movements/MovementFiltersSheet'
import { QuickAddFab } from '../../../components/transactions/QuickAddFab'
import { PendingRecurrencesBlock } from '../../../components/recurrences/PendingRecurrencesBlock'
import { PendingReimbursementsBlock } from '../../../components/transactions/PendingReimbursementsBlock'
import { RecurrenceSuggestionBanner } from '../../../components/recurrences/RecurrenceSuggestionBanner'
import {
  getMovementFilterOptions,
  getMovementsFeedPage,
  hasAnyTransaction,
} from '../../../lib/transactions/queries'
import {
  activeFilterCount,
  adaptFiltersForQuery,
  clearFiltersAndSearch,
  emptyFilters,
  hasActiveContentFilters,
  hasActiveSearch,
  type MovementFiltersState,
} from '../../../lib/transactions/feed-filters'
import { useLocale, useT } from '../../../lib/locale-context'
import { useShowCents } from '../../../lib/preferences-context'
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
/** Same debounce web uses; without it every keystroke is a round-trip to the DB. */
const SEARCH_DEBOUNCE_MS = 300

// Global Movimientos feed: month-navigable, filterable list + load more, reusing
// the shared read (`getMovementsFeedPage`) and the native MovementList. The
// QuickAddFab opens the create form; tapping a row opens the movement detail
// (`/transactions/[txId]`).
//
// Filters are resolved BY THE DATABASE, never over the page already received:
// the feed paginates, so filtering the loaded rows would answer "which of these
// 50 match" instead of "which rows of the month match". The account detail is
// the surface that filters in memory, and only because it loads its account's
// full history for the running balance.
export default function MovimientosScreen() {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const showCents = useShowCents()

  const todayISO = formatDateISO(getTodayAR())
  const currentMonth = monthOf(getTodayAR())

  const [filters, setFilters] = useState<MovementFiltersState>(() => emptyFilters(currentMonth))
  const [limit, setLimit] = useState(DEFAULT_MOVEMENTS_LIMIT)
  const [searchMode, setSearchMode] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Which category the OPTIONS catalog is fetched for. Tracks the sheet's draft
  // (not the committed filter) so picking a category surfaces its subcategories
  // without a second pass through the sheet.
  const [optionsCategoryId, setOptionsCategoryId] = useState<string | null>(null)

  // Single mutation point: every filter change resets the page limit in the SAME
  // state update. Doing it in two setStates would fire an intermediate fetch
  // with the new filter and the old limit — `limit` is part of the query key.
  const applyFilters = (next: MovementFiltersState) => {
    setFilters(next)
    setLimit(DEFAULT_MOVEMENTS_LIMIT)
  }
  const patchFilters = (patch: Partial<MovementFiltersState>) =>
    applyFilters({ ...filters, ...patch })

  // Debounced search: the draft drives the input, the committed value drives the
  // query key.
  useEffect(() => {
    if (searchDraft === filters.query) return
    const handle = setTimeout(() => {
      applyFilters({ ...filters, query: searchDraft })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  const { month } = filters
  const monthsBack = monthIndex(currentMonth) - monthIndex(month)
  const canGoBack = monthsBack < HISTORY_MONTHS_BACK
  const canGoForward = monthsBack > 0
  const [year, monthNum] = month.split('-').map(Number)

  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters])

  const feedQuery = useQuery({
    queryKey: ['transactions', 'feed', { filters: adapted, limit }] as const,
    queryFn: () => getMovementsFeedPage(adapted, limit),
  })

  const optionsQuery = useQuery({
    queryKey: ['transactions', 'filter-options', optionsCategoryId] as const,
    queryFn: () => getMovementFilterOptions(optionsCategoryId),
  })
  const options = optionsQuery.data

  const movements = feedQuery.data?.movements ?? []
  const isEmpty = feedQuery.isSuccess && movements.length === 0
  const hasFilters = hasActiveContentFilters(filters)
  const hasSearch = hasActiveSearch(filters)
  const narrowed = hasFilters || hasSearch

  // Only needed to pick between the welcome and month-empty copies. Skipped when
  // the list was narrowed by the user: in that case the cause is already known,
  // so the query would be I/O spent on an answer nobody reads.
  const hasAnyQuery = useQuery({
    queryKey: ['transactions', 'has-any'] as const,
    queryFn: hasAnyTransaction,
    enabled: isEmpty && !narrowed,
  })

  const clearAll = () => {
    setSearchDraft('')
    setSearchMode(false)
    applyFilters(clearFiltersAndSearch(filters))
  }

  const monthLabel = `${MONTHS[locale][monthNum - 1]} ${year}`
  const emptyState = !isEmpty
    ? undefined
    : narrowed
      ? {
          title: hasFilters
            ? t('transactions.empty.filter_title')
            : t('transactions.empty.search_title'),
          body: hasFilters
            ? t('transactions.empty.filter_description')
            : t('transactions.empty.search_description', { query: filters.query }),
          action: {
            label: hasFilters
              ? t('transactions.empty.clear_filters')
              : t('transactions.empty.clear_search'),
            onPress: clearAll,
          },
        }
      : hasAnyQuery.data === false
        ? {
            title: t('transactions.empty.welcome.title'),
            body: t('transactions.empty.welcome.body'),
          }
        : {
            title: t('transactions.empty.month.title', { month: monthLabel }),
            body: t('transactions.empty.month.body'),
          }

  const activeCount = activeFilterCount(filters)
  const formatAmount = (amount: number) =>
    filters.currency === 'USD' ? formatUSD(amount, showCents) : formatARS(amount, showCents)

  // Active-filter chips (removable). month + query have their own controls.
  const chips: ActiveFilterChip[] = []
  if (filters.type) {
    chips.push({
      key: 'type',
      label: t(`transactions.movement_kinds.${filters.type}`),
      onRemove: () => patchFilters({ type: null }),
    })
  }
  if (filters.accountId) {
    chips.push({
      key: 'account',
      label:
        options?.accounts.find((a) => a.id === filters.accountId)?.name ??
        t('transactions.filters.account'),
      onRemove: () => patchFilters({ accountId: null }),
    })
  }
  if (filters.categoryId) {
    const category = options?.categories.find((c) => c.id === filters.categoryId)
    chips.push({
      key: 'category',
      label: category
        ? category.user_id === null
          ? t(`categories.${category.canonical_name}`)
          : category.name
        : t('transactions.filters.category'),
      onRemove: () => patchFilters({ categoryId: null, subcategoryId: null }),
    })
  }
  if (filters.categoryId && filters.subcategoryId) {
    const sub = options?.subcategories.find((s) => s.id === filters.subcategoryId)
    chips.push({
      key: 'subcategory',
      label: sub
        ? sub.user_id === null
          ? t(`subcategories.${sub.canonical_name}`)
          : sub.name
        : t('transactions.filters.subcategory'),
      onRemove: () => patchFilters({ subcategoryId: null }),
    })
  }
  if (filters.currency) {
    chips.push({
      key: 'currency',
      label: filters.currency,
      onRemove: () => patchFilters({ currency: null }),
    })
  }
  if (filters.amountMin != null) {
    chips.push({
      key: 'amountMin',
      label: `≥ ${formatAmount(filters.amountMin)}`,
      onRemove: () => patchFilters({ amountMin: null }),
    })
  }
  if (filters.amountMax != null) {
    chips.push({
      key: 'amountMax',
      label: `≤ ${formatAmount(filters.amountMax)}`,
      onRemove: () => patchFilters({ amountMax: null }),
    })
  }

  const toggleSearch = () => {
    setSearchMode((prev) => {
      const next = !prev
      if (!next) {
        setSearchDraft('')
        applyFilters({ ...filters, query: '' })
      }
      return next
    })
  }

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
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_BOTTOM_OFFSET}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-6 py-6 pb-28"
      >
        <MonthNavigator
          year={year}
          month={monthNum}
          onPrev={canGoBack ? () => patchFilters({ month: shiftMonth(month, -1) }) : undefined}
          onNext={canGoForward ? () => patchFilters({ month: shiftMonth(month, +1) }) : undefined}
        />

        {/* Action chips: Buscar / Filtros. Recurrencias is NOT here — it already
            lives in this screen's PageHeader. */}
        <View className="flex-row flex-wrap items-center gap-2">
          <ActionChip
            icon={<Search size={14} color={searchMode ? colors.emeraldDeep : colors.textMuted} />}
            label={t('transactions.filters.search')}
            active={searchMode}
            onPress={toggleSearch}
          />
          <ActionChip
            icon={
              <SlidersHorizontal
                size={14}
                color={activeCount > 0 ? colors.emeraldDeep : colors.textMuted}
              />
            }
            label={t('transactions.filters.filters_button')}
            active={activeCount > 0}
            badge={activeCount > 0 ? activeCount : undefined}
            onPress={() => setFiltersOpen(true)}
          />
        </View>

        {searchMode && (
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
              <Search size={16} color={colors.textSoft} />
              <TextInput
                value={searchDraft}
                onChangeText={setSearchDraft}
                placeholder={t('transactions.filters.search_placeholder')}
                placeholderTextColor={colors.textSoft}
                autoFocus
                autoCorrect={false}
                className="h-11 flex-1 text-sm text-text"
              />
              {searchDraft.length > 0 && (
                <Pressable
                  onPress={() => setSearchDraft('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('transactions.filters.clear_search')}
                  hitSlop={6}
                >
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Pressable onPress={toggleSearch} accessibilityRole="button" hitSlop={6}>
              <Text className="text-sm font-medium text-emerald">
                {t('transactions.filters.cancel')}
              </Text>
            </Pressable>
          </View>
        )}

        <ActiveFilterChips chips={chips} />

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
      </KeyboardAwareScrollView>

      <MovementFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
        options={options}
        onDraftCategoryChange={setOptionsCategoryId}
      />
      <QuickAddFab />
    </View>
  )
}

function ActionChip({
  icon,
  label,
  active = false,
  badge,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
      }`}
    >
      {icon}
      <Text className={`text-[13px] ${active ? 'font-semibold text-text' : 'text-text-soft'}`}>
        {label}
      </Text>
      {badge !== undefined && (
        <View className="rounded-full bg-emerald px-1.5">
          <Text className="text-[11px] font-bold text-white">{badge}</Text>
        </View>
      )}
    </Pressable>
  )
}
