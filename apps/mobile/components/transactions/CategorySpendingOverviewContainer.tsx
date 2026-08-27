import { useMemo } from 'react'
import { Text, View } from 'react-native'
import {
  buildCategorySlices,
  buildSubcategorySlices,
  DONUT_TOP,
  groupForDonut,
  NO_OTHERS_CAP,
  type CategoryBreakdown,
} from '@grana/money-logic'
import { SUBCATEGORY_NONE_MARKER } from '@grana/transactions'
import { UNCATEGORIZED_ID } from '@grana/dashboard'
import {
  useHasUsdAccount,
  useMonthCategoryBreakdown,
  useMonthIncomeBreakdown,
  useMonthSubcategoryBreakdown,
} from '../../lib/dashboard/queries'
import type { MovementFiltersState } from '../../lib/transactions/feed-filters'
import type { MovementFilterOptions } from '../../lib/transactions/queries'
import { useT } from '../../lib/locale-context'
import {
  CategorySpendingOverview,
  type CategorySpendingCredit,
} from './CategorySpendingOverview'
import { CategorySpendingOverviewSkeleton } from './CategorySpendingOverviewSkeleton'

type Props = {
  filters: MovementFiltersState
  patchFilters: (patch: Partial<MovementFiltersState>) => void
  /** Filter catalog the screen already loads — used to name the drilled category. */
  options: MovementFilterOptions | undefined
}

/**
 * Wires the native "En qué se fue" card to the Movimientos screen's filter state.
 *
 * The card has NO state of its own beyond the ranking's expand toggle: which
 * breakdown it shows is derived from the filters, and every interaction writes
 * back to them. That is the same shape web uses, and it is what keeps the donut
 * from ever disagreeing with the feed underneath it — there is only one source
 * of truth for "which month, which currency, which category".
 *
 *   egresos, no category  → month category breakdown (the all-categories donut)
 *   egresos + category    → that category's subcategory breakdown (the drill)
 *   ingresos              → month income breakdown
 */
export function CategorySpendingOverviewContainer({ filters, patchFilters, options }: Props) {
  const t = useT()
  const [year, monthNum] = filters.month.split('-').map(Number)

  const mode = filters.overviewMode
  // The card reads ONE currency at a time and defaults to ARS, mirroring the
  // breakdown's "never sum ARS and USD" rule.
  const currency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'

  // Drill: any active category in egresos puts the donut inside that category.
  // It stays there while a subcategory narrows the list — snapping back to all
  // categories would leave the donut contradicting a still-filtered feed.
  const drilled = mode === 'egresos' && Boolean(filters.categoryId)

  const usdQ = useHasUsdAccount()
  const categoryQ = useMonthCategoryBreakdown(year, monthNum, mode === 'egresos')
  const incomeQ = useMonthIncomeBreakdown(year, monthNum, mode === 'ingresos')
  const subcategoryQ = useMonthSubcategoryBreakdown(
    year,
    monthNum,
    drilled ? filters.categoryId : null,
  )

  const activeQ = mode === 'ingresos' ? incomeQ : categoryQ

  // Localized name of the drilled category, for the card's breadcrumb. Comes
  // from the catalog the screen already loaded for the filters sheet, so the
  // drill costs no extra request.
  const activeCategoryName = useMemo(() => {
    if (!drilled || !filters.categoryId) return undefined
    const category = options?.categories.find((c) => c.id === filters.categoryId)
    if (!category) return undefined
    return category.user_id === null ? t(`categories.${category.canonical_name}`) : category.name
  }, [drilled, filters.categoryId, options, t])

  // ── The ranking's data: every category, uncapped ───────────────────────────
  // Built WITHOUT the "Otros" tail so each category survives as its own row and
  // the ranking can reveal them all; the donut regroups to top-N separately.
  const rankingBreakdown = useMemo<CategoryBreakdown | null>(() => {
    const relabelCategory = <
      T extends {
        categoryId: string
        label: string
        canonicalName?: string | null
        isSystem?: boolean
      },
    >(
      row: T,
    ): T =>
      row.categoryId === UNCATEGORIZED_ID
        ? { ...row, label: t('transactions.spending.uncategorized') }
        : row.isSystem && row.canonicalName
          ? { ...row, label: t(`categories.${row.canonicalName}`) }
          : row

    if (mode === 'ingresos') {
      const raw = incomeQ.data
      if (!raw) return null
      return buildCategorySlices(raw[currency].map(relabelCategory), {
        topN: NO_OTHERS_CAP,
        othersLabel: t('transactions.spending.others'),
      })
    }

    if (drilled) {
      const raw = subcategoryQ.data
      if (!raw) return null
      const sub = buildSubcategorySlices(
        raw[currency].map((row) => ({
          ...row,
          label:
            row.subcategoryId === null
              ? t('transactions.spending.no_subcategory')
              : row.isSystem && row.canonicalName
                ? t(`subcategories.${row.canonicalName}`)
                : row.label,
        })),
      )
      // Project SubcategorySlice → CategorySlice: same shape, and the card reads
      // `categoryId` as "the id this row filters by" whatever level it is at.
      return {
        total: sub.total,
        slices: sub.slices.map((s) => ({
          categoryId: s.subcategoryId ?? SUBCATEGORY_NONE_MARKER,
          label: s.label,
          color: s.color,
          icon: s.icon,
          value: s.value,
          percentage: s.percentage,
          offset: s.offset,
        })),
      }
    }

    const raw = categoryQ.data
    if (!raw) return null
    return buildCategorySlices(raw[currency].map(relabelCategory), {
      topN: NO_OTHERS_CAP,
      othersLabel: t('transactions.spending.others'),
    })
  }, [mode, currency, drilled, incomeQ.data, categoryQ.data, subcategoryQ.data, t])

  // The donut gets a legible top-N + "Otros"; inside a category we keep every
  // sub-arc, matching web.
  const donutBreakdown = useMemo<CategoryBreakdown | null>(() => {
    if (!rankingBreakdown) return null
    if (drilled) return rankingBreakdown
    return groupForDonut(rankingBreakdown, DONUT_TOP, t('transactions.spending.others'))
  }, [rankingBreakdown, drilled, t])

  // Categories in credit ("te devolvieron") — egresos, all-categories only.
  // Income never produces them, and the subcategory drill does not surface them.
  const credits = useMemo<CategorySpendingCredit[]>(() => {
    if (mode !== 'egresos' || drilled) return []
    const raw = categoryQ.data
    if (!raw) return []
    return raw.credits[currency].map((row) => ({
      categoryId: row.categoryId,
      label:
        row.categoryId === UNCATEGORIZED_ID
          ? t('transactions.spending.uncategorized')
          : row.isSystem && row.canonicalName
            ? t(`categories.${row.canonicalName}`)
            : row.label,
      color: row.color ?? null,
      value: row.value,
    }))
  }, [mode, drilled, currency, categoryQ.data, t])

  if (activeQ.isError || (drilled && subcategoryQ.isError)) {
    return (
      <View className="rounded-xl border border-dashed border-border px-4 py-6">
        <Text className="text-center text-[13px] text-text-muted">
          {t('transactions.route.feed_error')}
        </Text>
      </View>
    )
  }

  if (!rankingBreakdown || !donutBreakdown || usdQ.data === undefined) {
    return <CategorySpendingOverviewSkeleton />
  }

  return (
    <CategorySpendingOverview
      breakdown={donutBreakdown}
      rankingSlices={rankingBreakdown.slices}
      currency={currency}
      mode={mode}
      hasUsd={Boolean(usdQ.data)}
      parentCategoryId={drilled ? (filters.categoryId ?? undefined) : undefined}
      activeCategoryName={activeCategoryName}
      selectedRowId={drilled ? filters.subcategoryId : null}
      credits={credits}
      onSetMode={(next) => {
        // Leaving egresos abandons the category drill: the income donut has no
        // in-category view, so keeping the filter would narrow the feed by a
        // category the card no longer shows.
        patchFilters(
          next === 'ingresos'
            ? { overviewMode: next, categoryId: null, subcategoryId: null }
            : { overviewMode: next },
        )
      }}
      onSetCurrency={(next) => patchFilters({ currency: next })}
      onSelectCategory={(id) => {
        if (drilled) {
          // Inside a category the rows ARE its subcategories: tapping one narrows
          // the feed, tapping the selected one again widens back to the whole
          // category — without leaving the drill.
          patchFilters({ subcategoryId: filters.subcategoryId === id ? null : id })
          return
        }
        if (mode === 'ingresos') {
          // The income drill falls through to the general CAJA feed, which needs
          // an explicit currency + type to match what the income donut counted.
          patchFilters({ currency, type: 'income', categoryId: id })
          return
        }
        // Egresos deliberately does NOT pin the currency: the donut and the feed
        // read it from the same place, so pinning it would leave a stray filter
        // behind after drilling back out.
        patchFilters({
          categoryId: filters.categoryId === id ? null : id,
          subcategoryId: null,
        })
      }}
      onClearCategory={() => patchFilters({ categoryId: null, subcategoryId: null })}
    />
  )
}
