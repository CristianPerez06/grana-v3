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
import {
  getAllCategoriesAction,
  getMonthCategoryBreakdownAction,
  getMonthIncomeBreakdownAction,
  getMonthSubcategoryBreakdownAction,
  hasUsdActivityInMonthAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { UNCATEGORIZED_ID } from '@grana/dashboard'
import { SUBCATEGORY_NONE_MARKER } from '@/lib/transactions/filters'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'
import {
  getCategoryName,
  translateCategoryLabel,
  translateSubcategoryLabel,
} from '@/lib/categories/display'

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

  // Subcategory drill-in mode: only in egresos with a single category filter
  // and no further subcategory narrowing.
  const breakdownMode: 'category' | 'subcategory' =
    overviewMode === 'egresos' && filters.categoryId && !filters.subcategoryId
      ? 'subcategory'
      : 'category'

  const [usdQ, categoryBreakdownQ, incomeBreakdownQ, subcategoryDrillQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.breakdownUsdActivity(month),
        queryFn: () => hasUsdActivityInMonthAction(month),
      },
      {
        queryKey: QUERY_KEYS.breakdownExpense(month),
        queryFn: () => getMonthCategoryBreakdownAction(month),
        enabled: overviewMode === 'egresos',
      },
      {
        queryKey: QUERY_KEYS.breakdownIncome(month),
        queryFn: () => getMonthIncomeBreakdownAction(month),
        enabled: overviewMode === 'ingresos',
      },
      {
        queryKey: QUERY_KEYS.breakdownExpenseSubcategory(month, filters.categoryId ?? ''),
        queryFn: () =>
          getMonthSubcategoryBreakdownAction(month, filters.categoryId as string),
        enabled: breakdownMode === 'subcategory' && Boolean(filters.categoryId),
      },
    ],
  })

  // Categories tree is already cached by the header / drawer loader; we read
  // from it to label the active category on the in-category breadcrumb.
  const categoriesTreeQ = useQuery({
    queryKey: QUERY_KEYS.categoriesTree,
    queryFn: () => getAllCategoriesAction(),
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
      const ars = buildCategorySlices(fill(raw.ARS), { othersLabel: t('spending.others') })
      const usd = buildCategorySlices(fill(raw.USD), { othersLabel: t('spending.others') })
      return overviewCurrency === 'USD' ? usd : ars
    }
    // egresos
    const raw = categoryBreakdownQ.data
    if (!raw) return null
    const fill = (rows: typeof raw.ARS) => rows.map(relabel)
    const arsCategory = buildCategorySlices(fill(raw.ARS), { othersLabel: t('spending.others') })
    const usdCategory = buildCategorySlices(fill(raw.USD), { othersLabel: t('spending.others') })

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
      centerLabel:
        overviewMode === 'ingresos'
          ? t('spending.income_center_label')
          : t('spending.center_label'),
      categoriesCaptionTemplate: t.raw('spending.categories_caption') as string,
      offLedgerNote: t('spending.off_ledger_note'),
      seeDetail: t('spending.see_detail'),
      othersLabelTemplate: t.raw('spending.others_label') as string,
      seeAllCategories: t('spending.see_all_categories'),
      emptyMessage:
        overviewMode === 'ingresos' ? t('spending.income_empty') : t('spending.empty'),
      modeEgresos: t('spending.mode_egresos'),
      modeIngresos: t('spending.mode_ingresos'),
      subtitle:
        overviewMode === 'ingresos'
          ? t('spending.income_subtitle')
          : t('spending.subtitle_egresos'),
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
        // The breakdown is per-currency, so the row click pins the list to the
        // currency being visualized — the list then shows exactly the movements
        // behind the clicked slice (legacy URL hrefs did the same via
        // `&currency=`, and `&type=income` in ingresos mode).
        dispatch({ type: 'setCurrency', currency: overviewCurrency })
        // In subcategory mode the row id is the subcategoryId of the active
        // parent; everywhere else it's a top-level category.
        if (breakdownMode === 'subcategory' && filters.categoryId) {
          dispatch({ type: 'setSubcategory', subcategoryId: categoryId })
          return
        }
        if (overviewMode === 'ingresos') {
          dispatch({ type: 'setType', movementType: 'income' })
        }
        dispatch({ type: 'setCategory', categoryId })
      },
    }),
    [dispatch, breakdownMode, filters.categoryId, overviewCurrency, overviewMode],
  )

  // Loading state: render a skeleton card that calques the geometry of the
  // real overview (month header + mode tabs + donut + ranking) so the page
  // doesn't jolt when data lands. The original "Sin gastos este mes" text is
  // the genuine empty state — only shown after the queries resolve with no
  // slices.
  if (!overviewBreakdown || usdQ.data === undefined) {
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
      breakdown={overviewBreakdown}
      hasUsd={Boolean(usdQ.data)}
      arsHref="#"
      usdHref="#"
      month={month}
      parentCategoryId={breakdownMode === 'subcategory' ? filters.categoryId ?? undefined : undefined}
      subBreakdownsByCategory={subBreakdownsByCategory}
      labels={labels}
      controller={controller}
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
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card px-7 py-6"
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
