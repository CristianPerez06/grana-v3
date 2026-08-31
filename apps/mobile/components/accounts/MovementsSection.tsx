import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Repeat, Search, SlidersHorizontal, X } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  toFinancialMovement,
  type FinancialMovement,
  type TransactionWithDetails,
} from '@grana/transactions'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'
import {
  applyAccountFilters,
  activeFilterCount,
  currentMonth,
  emptyFilters,
  monthLabel,
  shiftMonth,
  type AccountMovementFilters,
} from '../../lib/accounts/movement-filters'
import { getMovementFilterOptions } from '../../lib/transactions/queries'
import { MovementRow } from './MovementRow'
import { MovementRowsSkeleton } from './MovementRowsSkeleton'
import { MovementFiltersSheet } from '../movements/MovementFiltersSheet'
import {
  ActiveFilterChips,
  type ActiveFilterChip,
} from '../movements/ActiveFilterChips'

type Props = {
  movements: TransactionWithDetails[]
  accountId: string
  loading: boolean
}

// Movements list with the full toolbar: month navigation, free-text search, a
// link to recurrences, and a filters sheet (type / category / subcategory /
// currency / amount) with removable active-filter chips. Parity with the web
// account-detail movements toolbar; filtering reuses the shared month range and
// a native filter pass over `TransactionWithDetails`.
export function MovementsSection({ movements, accountId, loading }: Props) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const showCents = useShowCents()

  const [filters, setFilters] = useState<AccountMovementFilters>(() => emptyFilters(currentMonth()))
  const [searchMode, setSearchMode] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Which category the OPTIONS catalog is fetched for. Tracks the sheet's draft
  // so picking a category surfaces its subcategories in the same pass.
  const [optionsCategoryId, setOptionsCategoryId] = useState<string | null>(null)

  // Options come from the CATALOG, same as the web account detail and the global
  // feed — one source for the shared sheet instead of two with different
  // semantics. The trade-off is accepted: the menu may offer a category with no
  // rows in this account.
  const optionsQuery = useQuery({
    queryKey: ['transactions', 'filter-options', optionsCategoryId] as const,
    queryFn: () => getMovementFilterOptions(optionsCategoryId),
  })
  const options = optionsQuery.data

  // The derived `FinancialMovement` per row, which the filters need twice over:
  // the type axis is the DERIVED `kind` (not the `transaction_type` column) so
  // the shared sheet speaks one language on both surfaces, and the free-text
  // match runs on the same shared `movementMatchesText` web uses, which reads
  // this model. Derived once per movements load with `toFinancialMovement` — the
  // repo's single kind derivation — not on every filter interaction.
  const movementById = useMemo(() => {
    const map = new Map<string, FinancialMovement>()
    for (const tx of movements) map.set(tx.id, toFinancialMovement(tx))
    return map
  }, [movements])

  const filtered = useMemo(
    () => applyAccountFilters(movements, filters, movementById).slice().reverse(),
    [movements, filters, movementById],
  )
  const activeCount = activeFilterCount(filters)

  const categoryLabelFor = (id: string) => {
    const category = options?.categories.find((c) => c.id === id)
    if (!category) return null
    return category.user_id === null
      ? t(`categories.${category.canonical_name}`)
      : category.name
  }
  const subcategoryLabelFor = (subId: string) => {
    const sub = options?.subcategories.find((s) => s.id === subId)
    if (!sub) return null
    return sub.user_id === null ? t(`subcategories.${sub.canonical_name}`) : sub.name
  }

  // Active-filter chips (removable). month + query have their own controls.
  const chips: ActiveFilterChip[] = []
  if (filters.type) {
    chips.push({
      key: 'type',
      label: t(`transactions.movement_kinds.${filters.type}`),
      onRemove: () => setFilters((f) => ({ ...f, type: null })),
    })
  }
  if (filters.categoryId) {
    chips.push({
      key: 'category',
      label: categoryLabelFor(filters.categoryId) ?? t('transactions.filters.category'),
      onRemove: () => setFilters((f) => ({ ...f, categoryId: null, subcategoryId: null })),
    })
  }
  if (filters.categoryId && filters.subcategoryId) {
    chips.push({
      key: 'subcategory',
      label:
        subcategoryLabelFor(filters.subcategoryId) ?? t('transactions.filters.subcategory'),
      onRemove: () => setFilters((f) => ({ ...f, subcategoryId: null })),
    })
  }
  if (filters.currency) {
    chips.push({
      key: 'currency',
      label: filters.currency,
      onRemove: () => setFilters((f) => ({ ...f, currency: null })),
    })
  }
  if (filters.amountMin != null) {
    chips.push({
      key: 'amountMin',
      label: `≥ ${filters.currency === 'USD' ? formatUSD(filters.amountMin, showCents) : formatARS(filters.amountMin, showCents)}`,
      onRemove: () => setFilters((f) => ({ ...f, amountMin: null })),
    })
  }
  if (filters.amountMax != null) {
    chips.push({
      key: 'amountMax',
      label: `≤ ${filters.currency === 'USD' ? formatUSD(filters.amountMax, showCents) : formatARS(filters.amountMax, showCents)}`,
      onRemove: () => setFilters((f) => ({ ...f, amountMax: null })),
    })
  }

  const toggleSearch = () => {
    setSearchMode((prev) => {
      const next = !prev
      if (!next) setFilters((f) => ({ ...f, query: '' }))
      return next
    })
  }

  return (
    <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
      {/* Toolbar: title + month nav */}
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[15px] font-bold text-text">{t('accounts.headers.movements')}</Text>
        <View className="flex-row items-center gap-0.5 rounded-lg border border-border px-1">
          <Pressable
            onPress={() => setFilters((f) => ({ ...f, month: shiftMonth(f.month, -1) }))}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.filters.prev_month')}
            hitSlop={6}
            className="p-1.5"
          >
            <ChevronLeft size={16} color={colors.textMuted} />
          </Pressable>
          <Text className="min-w-[104px] text-center text-[13px] font-semibold capitalize text-text">
            {monthLabel(filters.month, locale)}
          </Text>
          <Pressable
            onPress={() => setFilters((f) => ({ ...f, month: shiftMonth(f.month, 1) }))}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.filters.next_month')}
            hitSlop={6}
            className="p-1.5"
          >
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Action chips: Buscar / Recurrencias / Filtros */}
      <View className="flex-row flex-wrap items-center gap-2">
        <ActionChip
          icon={<Search size={14} color={searchMode ? colors.emeraldDeep : colors.textMuted} />}
          label={t('transactions.filters.search')}
          active={searchMode}
          onPress={toggleSearch}
        />
        <ActionChip
          icon={<Repeat size={14} color={colors.textMuted} />}
          label={t('transactions.header.see_recurrences')}
          onPress={() => router.push('/transactions/recurring')}
        />
        <ActionChip
          icon={<SlidersHorizontal size={14} color={activeCount > 0 ? colors.emeraldDeep : colors.textMuted} />}
          label={t('transactions.filters.filters_button')}
          active={activeCount > 0}
          badge={activeCount > 0 ? activeCount : undefined}
          onPress={() => setFiltersOpen(true)}
        />
      </View>

      {/* Inline search */}
      {searchMode && (
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search size={16} color={colors.textSoft} />
            <TextInput
              value={filters.query}
              onChangeText={(q) => setFilters((f) => ({ ...f, query: q }))}
              placeholder={t('transactions.filters.search_placeholder')}
              placeholderTextColor={colors.textSoft}
              autoFocus
              autoCorrect={false}
              className="h-11 flex-1 text-sm text-text"
            />
            {filters.query.length > 0 && (
              <Pressable
                onPress={() => setFilters((f) => ({ ...f, query: '' }))}
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

      {/* Active filter chips */}
      <ActiveFilterChips chips={chips} />

      {/* List */}
      {loading ? (
        <MovementRowsSkeleton />
      ) : filtered.length === 0 ? (
        <Text className="py-6 text-center text-sm text-text-muted">
          {t('accounts.movements_empty')}
        </Text>
      ) : (
        <View className="-mx-5">
          {filtered.map((tx, index) => (
            <View key={tx.id} className={index === 0 ? '' : 'border-t border-border-soft'}>
              <MovementRow tx={tx} accountId={accountId} />
            </View>
          ))}
        </View>
      )}

      <MovementFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={setFilters}
        options={options}
        onDraftCategoryChange={setOptionsCategoryId}
        showAccountFilter={false}
      />
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
