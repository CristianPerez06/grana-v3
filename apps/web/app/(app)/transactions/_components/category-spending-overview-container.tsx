'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  buildCategorySlices,
  buildSubcategorySlices,
  type CategoryBreakdown,
  type SubcategoryBreakdown,
} from '@grana/money-logic'
import {
  CategorySpendingOverview,
  type CategorySpendingOverviewController,
} from '@/lib/transactions/components/category-spending-overview'
import { createClient } from '@/lib/supabase/client'
import {
  getMonthCategoryBreakdown,
  getMonthIncomeBreakdown,
  getMonthSubcategoryBreakdown,
  hasUsdAccount,
} from '@/lib/transactions/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { UNCATEGORIZED_ID } from '@grana/dashboard'
import { SUBCATEGORY_NONE_MARKER } from '@/lib/transactions/filters'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'
import {
  getCategoryName,
  translateCategoryLabel,
  translateSubcategoryLabel,
} from '@/lib/categories/display'

// We build the breakdown WITHOUT the "Otros" tail so every category survives as
// its own slice — the ranking list can then reveal them all (see the
// expandable "+ N categorías más" row in CategorySpendingOverview). The donut
// is regrouped to a clean top-N + "Otros" separately, in `groupForDonut` below.
const NO_OTHERS_CAP = Number.MAX_SAFE_INTEGER
// How many named arcs the donut shows before folding the rest into one "Otros"
// slice. Mirrors the previous buildCategorySlices default (topN: 6) so the donut
// stays visually identical.
const DONUT_TOP = 6

// Regroup an uncapped, sorted breakdown into the donut's top-N + "Otros" view,
// recomputing the cumulative offsets so the arcs stay contiguous. Pure mirror of
// buildCategorySlices' tail logic, applied after the fact so the ranking can
// keep the full per-category list.
function groupForDonut(
  breakdown: CategoryBreakdown,
  topN: number,
  othersLabel: string,
): CategoryBreakdown {
  if (breakdown.slices.length <= topN) return breakdown
  const named = breakdown.slices.slice(0, topN)
  const rest = breakdown.slices.slice(topN)
  const last = named[named.length - 1]
  const othersValue = rest.reduce((acc, s) => acc + s.value, 0)
  const othersPercentage = rest.reduce((acc, s) => acc + s.percentage, 0)
  return {
    total: breakdown.total,
    slices: [
      ...named,
      {
        categoryId: null,
        label: othersLabel,
        color: '#9CA3AF',
        icon: null,
        value: othersValue,
        percentage: othersPercentage,
        offset: last.offset + last.percentage,
      },
    ],
  }
}

/**
 * Client container for `<CategorySpendingOverview>`. Reads filters from the
 * route's React state (month, currency, overview mode, optional category /
 * subcategory) and fetches the breakdowns the donut needs:
 *
 *   - egresos mode:    month category breakdown + per-category subcategory
 *                      breakdowns for animated drill-in.
 *   - egresos + filter on a category: month subcategory breakdown of that
 *                      category (the "in-category" donut).
 *   - ingresos mode:   month income breakdown.
 *
 * Navigation interactions (prev/next month, currency, mode, row click) call a
 * controller that dispatches actions to the filters reducer. The component
 * keeps its URL-driven props for legacy callers (the old /transactions page)
 * but they are unused when `controller` is set.
 */
export function CategorySpendingOverviewContainer() {
  const { filters, dispatch } = useTransactionsFilters()
  const t = useTranslations('transactions')
  const tRoot = useTranslations()
  const locale = useLocale()

  const month = filters.month
  const overviewCurrency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'
  const overviewMode = filters.overviewMode

  // Subcategory drill-in mode: whenever egresos has a category filter active —
  // including after the user narrows to one of its subcategories. The donut
  // SHALL stay showing the category's subcategory breakdown while a subcategory
  // filters the list; it must NOT snap back to the all-categories view (that
  // left the donut contradicting the still-filtered list). Selecting a
  // subcategory only filters the list, keeping the "inside this category"
  // context.
  const breakdownMode: 'category' | 'subcategory' =
    overviewMode === 'egresos' && filters.categoryId ? 'subcategory' : 'category'

  const [usdQ, categoryBreakdownQ, incomeBreakdownQ, subcategoryDrillQ] = useQueries({
    queries: [
      {
        // Toggle visibility = "does the user use USD at all" (bimoneda), not
        // "did this month have USD movements" — so it shows on every month for
        // bimoneda users. Month-independent, so it caches across navigation.
        queryKey: QUERY_KEYS.hasUsdAccount,
        queryFn: () => hasUsdAccount(createClient()),
        staleTime: 30 * 60 * 1000,
      },
      {
        queryKey: QUERY_KEYS.breakdownExpense(month),
        queryFn: () => getMonthCategoryBreakdown(createClient(), month),
        enabled: overviewMode === 'egresos',
      },
      {
        queryKey: QUERY_KEYS.breakdownIncome(month),
        queryFn: () => getMonthIncomeBreakdown(createClient(), month),
        enabled: overviewMode === 'ingresos',
      },
      {
        queryKey: QUERY_KEYS.breakdownExpenseSubcategory(month, filters.categoryId ?? ''),
        queryFn: () =>
          getMonthSubcategoryBreakdown(createClient(), month, filters.categoryId as string),
        enabled: breakdownMode === 'subcategory' && Boolean(filters.categoryId),
      },
    ],
  })

  // Categories tree is already cached by the header / drawer loader; we read
  // from it to label the active category on the in-category breadcrumb.
  const categoriesTreeQ = useQuery({
    queryKey: QUERY_KEYS.categoriesTree,
    queryFn: () => getAllCategories(createClient()),
  })

  // ── Active breakdown (the donut's data) ────────────────────────────────────
  const overviewBreakdown = useMemo<CategoryBreakdown | null>(() => {
    // Uncategorized sentinel → i18n; system categories → localized label.
    const relabel = <
      T extends { categoryId: string; label: string; canonicalName?: string | null; isSystem?: boolean },
    >(
      i: T,
    ): T =>
      i.categoryId === UNCATEGORIZED_ID
        ? { ...i, label: t('spending.uncategorized') }
        : {
            ...i,
            label:
              translateCategoryLabel(i.label, i.canonicalName ?? null, i.isSystem ?? false, tRoot) ??
              i.label,
          }
    if (overviewMode === 'ingresos') {
      const raw = incomeBreakdownQ.data
      if (!raw) return null
      const fill = (rows: typeof raw.ARS) => rows.map(relabel)
      const ars = buildCategorySlices(fill(raw.ARS), {
        topN: NO_OTHERS_CAP,
        othersLabel: t('spending.others'),
      })
      const usd = buildCategorySlices(fill(raw.USD), {
        topN: NO_OTHERS_CAP,
        othersLabel: t('spending.others'),
      })
      return overviewCurrency === 'USD' ? usd : ars
    }
    // egresos
    const raw = categoryBreakdownQ.data
    if (!raw) return null
    const fill = (rows: typeof raw.ARS) => rows.map(relabel)
    const arsCategory = buildCategorySlices(fill(raw.ARS), {
      topN: NO_OTHERS_CAP,
      othersLabel: t('spending.others'),
    })
    const usdCategory = buildCategorySlices(fill(raw.USD), {
      topN: NO_OTHERS_CAP,
      othersLabel: t('spending.others'),
    })

    if (breakdownMode === 'subcategory' && filters.categoryId && subcategoryDrillQ.data) {
      const subRaw = subcategoryDrillQ.data
      const fillSub = (rows: typeof subRaw.ARS) =>
        rows.map((i) => ({
          ...i,
          label:
            i.subcategoryId === null
              ? t('spending.no_subcategory')
              : translateSubcategoryLabel(
                  i.label,
                  i.canonicalName ?? null,
                  i.isSystem ?? false,
                  tRoot,
                ) ?? i.label,
        }))
      const arsSub = buildSubcategorySlices(fillSub(subRaw.ARS))
      const usdSub = buildSubcategorySlices(fillSub(subRaw.USD))
      const selected = overviewCurrency === 'USD' ? usdSub : arsSub
      // Project SubcategorySlice → CategorySlice for the component (same shape).
      return {
        total: selected.total,
        slices: selected.slices.map((s) => ({
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

    return overviewCurrency === 'USD' ? usdCategory : arsCategory
  }, [
    overviewMode,
    overviewCurrency,
    breakdownMode,
    filters.categoryId,
    incomeBreakdownQ.data,
    categoryBreakdownQ.data,
    subcategoryDrillQ.data,
    t,
    tRoot,
  ])

  // The donut gets a clean top-N + "Otros" view; the ranking gets the full,
  // uncapped `overviewBreakdown.slices` so it can list every category. In the
  // in-category subcategory view we keep showing all sub-arcs (no "Otros"),
  // matching the previous behaviour.
  const donutBreakdown = useMemo<CategoryBreakdown | null>(() => {
    if (!overviewBreakdown) return null
    if (breakdownMode === 'subcategory') return overviewBreakdown
    return groupForDonut(overviewBreakdown, DONUT_TOP, t('spending.others'))
  }, [overviewBreakdown, breakdownMode, t])

  // Categories in credit ("te devolvieron") for the active currency — egresos
  // top-level only (income has none; subcategory drill doesn't surface them yet).
  const overviewCredits = useMemo(() => {
    if (overviewMode !== 'egresos' || breakdownMode === 'subcategory') return []
    const raw = categoryBreakdownQ.data
    if (!raw) return []
    return raw.credits[overviewCurrency].map((i) => ({
      categoryId: i.categoryId,
      label:
        i.categoryId === UNCATEGORIZED_ID
          ? t('spending.uncategorized')
          : translateCategoryLabel(i.label, i.canonicalName ?? null, i.isSystem ?? false, tRoot) ??
            i.label,
      color: i.color ?? null,
      value: i.value,
    }))
  }, [overviewMode, breakdownMode, overviewCurrency, categoryBreakdownQ.data, t, tRoot])

  // Pre-fetched subcategory breakdowns for in-place drill-down (category mode
  // only). We don't pre-fetch here in PR1; the existing animated drill-in still
  // works server-side via the legacy page, and this container will get the
  // pre-fetch logic in a follow-up commit if needed. For now: undefined ⇒ the
  // donut treats no category as drillable in-place.
  const subBreakdownsByCategory:
    | Record<string, { ARS: SubcategoryBreakdown; USD: SubcategoryBreakdown }>
    | undefined = undefined

  // ── Labels (i18n) ─────────────────────────────────────────────────────────
  const [yy, mm] = month.split('-').map(Number)
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  const activeCategory = useMemo(() => {
    if (breakdownMode !== 'subcategory' || !filters.categoryId) return null
    return (
      categoriesTreeQ.data?.find((c) => c.id === filters.categoryId) ?? null
    )
  }, [breakdownMode, filters.categoryId, categoriesTreeQ.data])

  const labels = useMemo(
    () => ({
      eyebrow:
        overviewMode === 'ingresos'
          ? t('spending.income_eyebrow')
          : activeCategory != null
            ? t('spending.eyebrow_in_category', {
                category: getCategoryName(activeCategory, tRoot),
              })
            : t('spending.eyebrow'),
      // Base eyebrow without the "dentro de X" suffix — used as the clickable
      // "back to all categories" crumb when a category filter is active.
      baseEyebrow:
        overviewMode === 'ingresos' ? t('spending.income_eyebrow') : t('spending.eyebrow'),
      activeCategoryName:
        activeCategory != null ? getCategoryName(activeCategory, tRoot) : undefined,
      centerLabel:
        overviewMode === 'ingresos'
          ? t('spending.income_center_label')
          : t('spending.center_label'),
      categoriesCaptionTemplate: t.raw('spending.categories_caption') as string,
      offLedgerNote: t('spending.off_ledger_note'),
      seeDetail: t('spending.see_detail'),
      othersLabelTemplate: t.raw('spending.others_label') as string,
      seeAllCategories: t('spending.see_all_categories'),
      showLess: t('spending.show_less'),
      emptyMessage:
        overviewMode === 'ingresos' ? t('spending.income_empty') : t('spending.empty'),
      modeEgresos: t('spending.mode_egresos'),
      modeIngresos: t('spending.mode_ingresos'),
      subtitle:
        overviewMode === 'ingresos'
          ? t('spending.income_subtitle')
          : t('spending.subtitle_egresos'),
      creditsLabel: tRoot('dashboard.spending.credits_label'),
    }),
    [overviewMode, activeCategory, t, tRoot],
  )

  // ── Controller: filters dispatch ───────────────────────────────────────────
  const controller: CategorySpendingOverviewController = useMemo(
    () => ({
      onPrevMonth: () => dispatch({ type: 'prevMonth' }),
      onNextMonth: () => dispatch({ type: 'nextMonth' }),
      onSetCurrency: (currency) => dispatch({ type: 'setCurrency', currency }),
      onSetMode: (mode) => dispatch({ type: 'setOverviewMode', mode }),
      onSelectCategory: (categoryId) => {
        // In subcategory mode the row id is the subcategoryId of the active
        // parent; everywhere else it's a top-level category. Clicking the
        // already-selected subcategory toggles it off (back to the whole
        // category) without leaving the drill.
        if (breakdownMode === 'subcategory' && filters.categoryId) {
          dispatch({
            type: 'setSubcategory',
            subcategoryId: filters.subcategoryId === categoryId ? null : categoryId,
          })
          return
        }
        if (overviewMode === 'ingresos') {
          // Ingresos drills into the general CAJA list (get_movements_page),
          // which needs an explicit currency + type filter to match the income
          // donut (per-currency, income only).
          dispatch({ type: 'setCurrency', currency: overviewCurrency })
          dispatch({ type: 'setType', movementType: 'income' })
        }
        // Egresos: the drilled reconciliation list derives its currency from the
        // same `filters.currency` as the donut (both map null→ARS), so pinning
        // the currency is redundant AND would leave a stray currency filter
        // active after drilling back out — so we do NOT pin it here.
        //
        // Toggle: clicking the already-active category clears the filter so the
        // chart and the movement list return to "all categories" in sync. (In
        // egresos this mostly fires from the breadcrumb/donut back affordance,
        // since selecting a category swaps the ranking to its subcategories.)
        dispatch({ type: 'setCategory', categoryId: filters.categoryId === categoryId ? null : categoryId })
      },
      // Clear the active category (and its subcategory) — returns the overview to
      // all categories and unfilters the list. Wired to the breadcrumb + donut.
      onClearCategory: () => dispatch({ type: 'setCategory', categoryId: null }),
    }),
    [
      dispatch,
      breakdownMode,
      filters.categoryId,
      filters.subcategoryId,
      overviewCurrency,
      overviewMode,
    ],
  )

  // Loading state: render a skeleton card that calques the geometry of the
  // real overview (month header + mode tabs + donut + ranking) so the page
  // doesn't jolt when data lands. The original "Sin gastos este mes" text is
  // the genuine empty state — only shown after the queries resolve with no
  // slices.
  if (!overviewBreakdown || !donutBreakdown || usdQ.data === undefined) {
    return <CategorySpendingOverviewSkeleton />
  }

  return (
    <CategorySpendingOverview
      monthLabel={monthLabel}
      // The href props are required by the component contract; they are unused
      // when `controller` is present (every Link becomes a button onClick).
      prevHref="#"
      nextHref="#"
      currency={overviewCurrency}
      mode={overviewMode}
      egresosHref="#"
      ingresosHref="#"
      breakdown={donutBreakdown}
      rankingSlices={overviewBreakdown.slices}
      hasUsd={Boolean(usdQ.data)}
      arsHref="#"
      usdHref="#"
      month={month}
      parentCategoryId={breakdownMode === 'subcategory' ? filters.categoryId ?? undefined : undefined}
      subBreakdownsByCategory={subBreakdownsByCategory}
      labels={labels}
      controller={controller}
      credits={overviewCredits}
    />
  )
}

/**
 * Layout-stable skeleton for the spending overview card. Mirrors the real
 * card's geometry (month header + mode tabs + donut + ranking rows) so the
 * page does not jolt when the data resolves.
 */
function CategorySpendingOverviewSkeleton() {
  return (
    <section
      aria-busy
      aria-label="Cargando desglose por categoría"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card px-5 py-6 sm:px-7"
    >
      {/* Header row: month nav + currency pills */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-muted animate-pulse" />
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
          <div className="size-7 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-6 w-11 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-11 rounded-full bg-muted/70 animate-pulse" />
        </div>
      </div>

      {/* Mode tabs (Egresos / Ingresos) */}
      <div className="flex flex-col gap-2">
        <div className="inline-flex w-fit gap-1 rounded-xl p-1" style={{ backgroundColor: '#EEF1F5' }}>
          <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-muted/70 animate-pulse" />
        </div>
        <div className="h-3.5 w-56 rounded bg-muted/70 animate-pulse" />
      </div>

      {/* Donut + ranking */}
      <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
        <div className="size-[200px] shrink-0 rounded-full bg-muted animate-pulse" />
        <ul className="flex flex-1 min-w-0 w-full flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 min-w-0">
              <div className="size-2.5 shrink-0 rounded-full bg-muted animate-pulse" />
              <div className="h-3.5 flex-1 rounded bg-muted animate-pulse" />
              <div className="h-3 w-10 shrink-0 rounded bg-muted/70 animate-pulse" />
              <div className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
