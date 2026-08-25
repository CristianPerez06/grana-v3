import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Repeat, Search, SlidersHorizontal, X } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { TransactionWithDetails } from '@grana/transactions'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'
import { resolveCategoryLabel } from '../../lib/accounts/movement-view'
import {
  applyAccountFilters,
  activeFilterCount,
  currentMonth,
  emptyFilters,
  monthLabel,
  shiftMonth,
  type AccountMovementFilters,
} from '../../lib/accounts/movement-filters'
import { MovementRow } from './MovementRow'
import { MovementRowsSkeleton } from './MovementRowsSkeleton'
import { MovementFiltersSheet, type CategoryOption } from './MovementFiltersSheet'

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

  // Category + subcategory options derived from the account's own movements, so
  // the filters never offer a category with no rows here.
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const map = new Map<string, { id: string; label: string; subs: Map<string, string> }>()
    for (const tx of movements) {
      if (!tx.category_id || !tx.category) continue
      let entry = map.get(tx.category_id)
      if (!entry) {
        entry = {
          id: tx.category_id,
          label: resolveCategoryLabel(tx.category, t) ?? tx.category.name,
          subs: new Map(),
        }
        map.set(tx.category_id, entry)
      }
      if (tx.subcategory_id && tx.subcategory) {
        const subLabel =
          tx.subcategory.user_id === null
            ? t(`subcategories.${tx.subcategory.canonical_name}`)
            : tx.subcategory.name
        entry.subs.set(tx.subcategory_id, subLabel)
      }
    }
    return [...map.values()].map((e) => ({
      id: e.id,
      label: e.label,
      subcategories: [...e.subs].map(([id, label]) => ({ id, label })),
    }))
  }, [movements, t])

  const filtered = useMemo(
    () => applyAccountFilters(movements, filters).slice().reverse(),
    [movements, filters],
  )
  const activeCount = activeFilterCount(filters)

  const categoryLabelFor = (id: string) =>
    categoryOptions.find((c) => c.id === id)?.label ?? null
  const subcategoryLabelFor = (catId: string, subId: string) =>
    categoryOptions.find((c) => c.id === catId)?.subcategories.find((s) => s.id === subId)?.label ??
    null

  // Active-filter chips (removable). month + query have their own controls.
  const chips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.type) {
    chips.push({
      key: 'type',
      label: t(`transactions.types.${filters.type}`),
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
        subcategoryLabelFor(filters.categoryId, filters.subcategoryId) ??
        t('transactions.filters.subcategory'),
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
      {chips.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onRemove}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-full bg-border-soft px-2.5 py-1"
            >
              <Text className="text-[12px] font-semibold text-text-muted">{chip.label}</Text>
              <X size={12} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

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
        categoryOptions={categoryOptions}
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
