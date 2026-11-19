import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Repeat, Search, SlidersHorizontal, X } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  computeRunningBalances,
  formatDateISO,
  getTodayAR,
  runningBalanceCurrencies,
  type BalanceCurrency,
  type RunningBalanceRow,
} from '@grana/money-logic'
import {
  DEFAULT_MOVEMENTS_LIMIT,
  MOVEMENTS_LIMIT_STEP,
  toFinancialMovement,
  type FinancialMovement,
  type TransactionWithDetails,
} from '@grana/transactions'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'
import {
  applyAccountFilters,
  activeFilterCount,
  currentMonth,
  emptyFilters,
  type AccountMovementFilters,
} from '../../lib/accounts/movement-filters'
import { getMovementFilterOptions } from '../../lib/transactions/queries'
import { MovementList } from '../movements/MovementList'
import { MovementRowsSkeleton } from './MovementRowsSkeleton'
import { MovementFiltersSheet } from '../movements/MovementFiltersSheet'
import { ToolbarIconButton } from '../movements/ToolbarIconButton'
import {
  ActiveFilterChips,
  type ActiveFilterChip,
} from '../movements/ActiveFilterChips'

type Props = {
  /** The account's full history, ascending (calculation order). */
  movements: TransactionWithDetails[]
  accountId: string
  /** The account's currencies with their initial balance: where the running balance starts. */
  currencies: readonly { currency_code: BalanceCurrency; initial_balance: number | string }[]
  loading: boolean
}

// The account's movements as one continuous list (like a bank statement), with
// the toolbar on the title row: free-text search, a link to recurrences, and a
// filters sheet (type / category / subcategory / «Desde / Hasta» / amount) with
// removable active-filter chips. Parity with the web account detail; rows are the
// shared `MovementList` the Movimientos tab uses.
export function MovementsSection({ movements, accountId, currencies, loading }: Props) {
  const t = useT()
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

  // Running balance (saldo corriente) per row — same shared functions as the web
  // account detail: snapshots over the FULL ascending history, and which
  // currencies to show decided once for the whole account.
  const running = useMemo(() => {
    const initial = {
      ARS: Number(currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0),
      USD: Number(currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0),
    }
    const rows = movements as RunningBalanceRow[]
    return {
      snapshots: computeRunningBalances(rows, accountId, initial),
      currencies: runningBalanceCurrencies(
        rows,
        accountId,
        initial,
        currencies.map((c) => c.currency_code),
      ),
    }
  }, [movements, accountId, currencies])

  // Currency lens: an account that uses both currencies shows one ledger at a
  // time (ARS by default, the primary currency); the ARS | USD pills switch it.
  // It is the same `filters.currency` the filters sheet sets, so both controls
  // always agree — same rule as the web account detail.
  const showCurrencyLens = running.currencies.length > 1
  const lens: BalanceCurrency | null = filters.currency ?? running.currencies[0] ?? null

  const filtered = useMemo(
    () =>
      applyAccountFilters(movements, filters, movementById, accountId, lens).slice().reverse(),
    [movements, filters, movementById, accountId, lens],
  )
  // Continuous list, paged like web («Ver más»). Any filter change starts over.
  const [limit, setLimit] = useState(DEFAULT_MOVEMENTS_LIMIT)
  const [prevFilters, setPrevFilters] = useState(filters)
  if (prevFilters !== filters) {
    setPrevFilters(filters)
    setLimit(DEFAULT_MOVEMENTS_LIMIT)
  }
  const visible = useMemo(
    () =>
      filtered
        .slice(0, limit)
        .map((tx) => movementById.get(tx.id))
        .filter((m): m is FinancialMovement => m != null),
    [filtered, limit, movementById],
  )
  const hasMore = filtered.length > limit
  const todayISO = formatDateISO(getTodayAR())
  // With the lens shown, the currency is not a filter: no badge count, no chip,
  // no block in the sheet (the sheet's «Limpiar» does not touch it either).
  const activeCount = activeFilterCount(showCurrencyLens ? { ...filters, currency: null } : filters)
  // Filters and a text search skip rows: a running balance over what is left
  // would be wrong, so it hides (same rule as the web account detail). The
  // currency is the exception — it is the lens and skips no row of its ledger.
  // The date range is navigation, not a content filter: each row's balance is
  // still the account's balance after it, so it stays (same as web).
  const showRunningBalance =
    activeFilterCount({ ...filters, currency: null, dateFrom: null, dateTo: null }) === 0 &&
    filters.query.trim().length === 0

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
  if (filters.currency && !showCurrencyLens) {
    chips.push({
      key: 'currency',
      label: filters.currency,
      onRemove: () => setFilters((f) => ({ ...f, currency: null })),
    })
  }
  if (filters.dateFrom || filters.dateTo) {
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y.slice(2)}`
    }
    chips.push({
      key: 'dateRange',
      label:
        filters.dateFrom && filters.dateTo
          ? `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`
          : filters.dateFrom
            ? `${t('transactions.filters.from')} ${fmt(filters.dateFrom)}`
            : `${t('transactions.filters.to')} ${fmt(filters.dateTo!)}`,
      onRemove: () => setFilters((f) => ({ ...f, dateFrom: null, dateTo: null })),
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
      {/* Title row: «Movimientos» + Buscar / Recurrencias / Filtros — same row
          as on web. No month navigator: the account reads as one continuous
          list, like a bank statement; «Desde / Hasta» in the filters finds a
          stretch. */}
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[15px] font-bold text-text">{t('accounts.headers.movements')}</Text>
        <View className="flex-row items-center gap-1.5">
          <ToolbarIconButton
            icon={<Search size={16} color={searchMode ? colors.emeraldDeep : colors.textMuted} />}
            label={t('transactions.filters.search')}
            active={searchMode}
            onPress={toggleSearch}
          />
          <ToolbarIconButton
            icon={<Repeat size={16} color={colors.textMuted} />}
            label={t('transactions.header.see_recurrences')}
            onPress={() => router.push('/transactions/recurring')}
          />
          <ToolbarIconButton
            icon={<SlidersHorizontal size={16} color={activeCount > 0 ? colors.emeraldDeep : colors.textMuted} />}
            label={t('transactions.filters.filters_button')}
            active={activeCount > 0}
            badge={activeCount > 0 ? activeCount : undefined}
            onPress={() => setFiltersOpen(true)}
          />
        </View>
      </View>

      {/* ARS | USD lens under the title — a way of looking at the account, not a
          filter. A phone has no room for it on the title row (web does the same). */}
      {showCurrencyLens && lens && (
        <CurrencyLensPills
          value={lens}
          onChange={(currency) => setFilters((f) => ({ ...f, currency }))}
        />
      )}

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


      {/* List — the same rows as the Movimientos tab (and as web), plus the
          running balance and the currency lens. Tapping opens the detail. */}
      {loading ? (
        <MovementRowsSkeleton />
      ) : visible.length === 0 ? (
        <Text className="py-6 text-center text-sm text-text-muted">
          {t('accounts.movements_empty')}
        </Text>
      ) : (
        <View className="-mx-5">
          <MovementList
            movements={visible}
            perspective={{ kind: 'account', accountId }}
            todayISO={todayISO}
            runningBalances={showRunningBalance ? running.snapshots : null}
            currencyLens={lens}
            onPressMovement={(m) => router.push(`/transactions/${m.id}`)}
          />
        </View>
      )}

      {hasMore && (
        <Pressable
          onPress={() => setLimit((n) => n + MOVEMENTS_LIMIT_STEP)}
          accessibilityRole="button"
          className="items-center self-center rounded-xl border border-border px-4 py-2.5"
        >
          <Text className="text-sm font-semibold text-text">{t('common.load_more')}</Text>
        </Pressable>
      )}

      <MovementFiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={setFilters}
        options={options}
        onDraftCategoryChange={setOptionsCategoryId}
        showAccountFilter={false}
        showCurrencyFilter={!showCurrencyLens}
        showDateRange
      />
    </View>
  )
}

/**
 * ARS | USD pills — the same control and look as the currency switch of
 * «¿En qué gasté?» (`CategorySpendingOverview`), so the two lenses read as one
 * app. Web renders the same control above the same list.
 */
function CurrencyLensPills({
  value,
  onChange,
}: {
  value: BalanceCurrency
  onChange: (currency: BalanceCurrency) => void
}) {
  return (
    <View className="flex-row items-center gap-1">
      {(['ARS', 'USD'] as const).map((code) => {
        const active = value === code
        return (
          <Pressable
            key={code}
            onPress={() => onChange(code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={8}
            className={`rounded-full border px-2.5 py-1 ${
              active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
            }`}
          >
            <Text className={`text-[11px] ${active ? 'font-extrabold text-text' : 'text-text-soft'}`}>
              {code}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
