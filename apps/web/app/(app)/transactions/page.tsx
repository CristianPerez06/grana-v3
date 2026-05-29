import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { buildCategorySlices, buildSubcategorySlices } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR, formatDateISO } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { MovementFilters } from '@/lib/transactions/components/movement-filters'
import { MovementList } from '@/lib/transactions/components/movement-list'
import { MovementListSkeleton } from '@/lib/transactions/components/movement-list-skeleton'
import { CategorySpendingOverview } from '@/lib/transactions/components/category-spending-overview'
import {
  buildFiltersClearedHref,
  buildMovementLimitHref,
  buildSearchClearedHref,
  monthOf,
  parseMovementFilters,
  parseMovementLimit,
  resolveEmptyVariant,
  shiftMonth,
} from '@/lib/transactions/filters'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { PendingReimbursementsBlock } from '@/lib/transactions/components/pending-reimbursements-block'
import {
  getGlobalMovementsPage,
  getMonthCategoryBreakdown,
  getMonthSubcategoryBreakdown,
  getMovementFilterOptions,
  getPendingReimbursements,
  hasAnyTransaction,
  UNCATEGORIZED_ID,
} from '@/lib/transactions/queries'
import type { SubcategoryBreakdown } from '@grana/money-logic'
import { SUBCATEGORY_NONE_MARKER } from '@/lib/transactions/filters'
import { getAccounts } from '@/lib/accounts/queries'
import { PendingRecurrencesBlock } from '@/lib/recurrences/components/pending-recurrences-block'
import { RecurrenceSuggestionBanner } from '@/lib/recurrences/components/recurrence-suggestion-banner'
import {
  generateDueRecurrenceInstances,
  getPendingRecurrenceInstances,
  getRecurrenceLinkedTransactionIds,
  getTopRecurrenceSuggestion,
} from '@/lib/recurrences/queries'

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: Promise<SearchParams>
}

const TransactionsPage = async ({ searchParams }: Props) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolvedSearchParams = await searchParams
  const filters = parseMovementFilters(resolvedSearchParams)
  const emptyVariant = resolveEmptyVariant(filters)
  const limit = parseMovementLimit(resolvedSearchParams)
  const t = await getTranslations('transactions')
  const tCommon = await getTranslations('common')

  // Generación lazy de instancias recurrentes: una pasada por carga de página.
  await generateDueRecurrenceInstances()

  const [movementsPage, filterOptions, pendingRecurrences, topSuggestion, pendingReimbursements] =
    await Promise.all([
      getGlobalMovementsPage({ limit, filters }),
      getMovementFilterOptions({ categoryId: filters.categoryId }),
      getPendingRecurrenceInstances(),
      getTopRecurrenceSuggestion(),
      getPendingReimbursements(),
    ])

  // Show the account filter and per-row account only when there are ≥2 accounts
  // to disambiguate; with a single account it is noise.
  const showAccount = filterOptions.accounts.length >= 2

  const recurrenceLinkedIds = await getRecurrenceLinkedTransactionIds(
    movementsPage.movements.map((m) => m.id),
  )

  // Available balance per cash/bank account (for the soft negative-balance
  // warning when confirming a pending recurrence).
  const availableByAccount: Record<string, Record<'ARS' | 'USD', number>> = {}
  if (pendingRecurrences.length > 0) {
    const { cash, bank } = await getAccounts()
    for (const account of [...cash, ...bank]) {
      availableByAccount[account.id] = account.balances
    }
  }

  // Carta de presentación: gastos por categoría (o por subcategoría dentro de
  // una categoría cuando hay filtro de categoría activo, ver §B del change
  // add-subcategory-filter-and-breakdown).
  const month = filters.month ?? monthOf(getTodayAR())
  const locale = await getLocale()
  const [yy, mm] = month.split('-').map(Number)
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  // Mode resolution: when the user filtered to exactly one category (and didn't
  // narrow further to a subcategory), the donut switches to in-category mode.
  // With a subcategory also filtered, the donut would be "100% in X" — pointless
  // — so it falls back to the category mode (which renders the single parent
  // category as a full donut, coherent with the rest of the module).
  const breakdownMode: 'category' | 'subcategory' =
    filters.categoryId && !filters.subcategoryId ? 'subcategory' : 'category'

  const overviewCurrency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'

  // Build the slices for both modes (category mode always runs; subcategory
  // mode runs only when triggered). The component renders both via the same
  // CategoryBreakdown shape — for subcategory mode, the page projects each
  // SubcategorySlice into a CategorySlice where `categoryId` holds either the
  // real subcategory uuid or `SUBCATEGORY_NONE_MARKER` for the "no subcategory"
  // bucket. Labels are resolved here (i18n).
  const categoryBreakdownRaw = await getMonthCategoryBreakdown(month)
  const fillCategoryLabels = (inputs: typeof categoryBreakdownRaw.ARS) =>
    inputs.map((i) =>
      i.categoryId === UNCATEGORIZED_ID ? { ...i, label: t('spending.uncategorized') } : i,
    )
  const arsCategoryBreakdown = buildCategorySlices(fillCategoryLabels(categoryBreakdownRaw.ARS), {
    othersLabel: t('spending.others'),
  })
  const usdCategoryBreakdown = buildCategorySlices(fillCategoryLabels(categoryBreakdownRaw.USD), {
    othersLabel: t('spending.others'),
  })
  const hasUsd = usdCategoryBreakdown.slices.length > 0

  const activeCategory =
    breakdownMode === 'subcategory' && filters.categoryId
      ? filterOptions.categories.find((c) => c.id === filters.categoryId) ?? null
      : null

  let overviewBreakdown = overviewCurrency === 'USD' ? usdCategoryBreakdown : arsCategoryBreakdown
  let overviewGetHref: ((slice: { categoryId: string | null }) => string | null) | undefined

  if (breakdownMode === 'subcategory' && filters.categoryId) {
    const subcategoryBreakdownRaw = await getMonthSubcategoryBreakdown(month, filters.categoryId)
    const fillSubLabels = (inputs: typeof subcategoryBreakdownRaw.ARS) =>
      inputs.map((i) => ({
        ...i,
        label: i.subcategoryId === null ? t('spending.no_subcategory') : i.label,
      }))
    const arsSubBreakdown = buildSubcategorySlices(fillSubLabels(subcategoryBreakdownRaw.ARS))
    const usdSubBreakdown = buildSubcategorySlices(fillSubLabels(subcategoryBreakdownRaw.USD))
    const selectedSub = overviewCurrency === 'USD' ? usdSubBreakdown : arsSubBreakdown
    // Project SubcategorySlice → CategorySlice for the component (same shape).
    // null subcategoryId becomes SUBCATEGORY_NONE_MARKER in the projected
    // `categoryId` so the drill-down href can map it back to the URL marker.
    overviewBreakdown = {
      total: selectedSub.total,
      slices: selectedSub.slices.map((s) => ({
        categoryId: s.subcategoryId ?? SUBCATEGORY_NONE_MARKER,
        label: s.label,
        color: s.color,
        icon: s.icon,
        value: s.value,
        percentage: s.percentage,
        offset: s.offset,
      })),
    }
    // Drill-down: preserves the parent category, adds the subcategory.
    const parentCategoryId = filters.categoryId
    overviewGetHref = (slice) =>
      slice.categoryId
        ? `/transactions?month=${month}&category=${parentCategoryId}&subcategory=${slice.categoryId}&currency=${overviewCurrency}`
        : null
  }

  // Pre-fetch subcategory breakdowns for all drillable top-level categories so
  // the spending overview can animate the drill-in in situ without a round-trip.
  const drillableCategoryIds = arsCategoryBreakdown.slices
    .filter((s) => s.categoryId !== null)
    .map((s) => s.categoryId!)

  const subBreakdownsByCategory: Record<string, { ARS: SubcategoryBreakdown; USD: SubcategoryBreakdown }> = {}
  if (drillableCategoryIds.length > 0 && breakdownMode === 'category') {
    const rawPairs = await Promise.all(
      drillableCategoryIds.map((catId) => getMonthSubcategoryBreakdown(month, catId)),
    )
    drillableCategoryIds.forEach((catId, i) => {
      const raw = rawPairs[i]
      subBreakdownsByCategory[catId] = {
        ARS: buildSubcategorySlices(raw.ARS),
        USD: buildSubcategorySlices(raw.USD),
      }
    })
  }

  // The month nav lives in the spending overview card below. The page header
  // stays minimalist: just the title and the recurrences shortcut in the
  // actions slot.
  const currencySuffix = overviewCurrency === 'USD' ? '&currency=USD' : ''
  const overviewPrevHref = `/transactions?month=${shiftMonth(month, -1)}${currencySuffix}`
  const overviewNextHref = `/transactions?month=${shiftMonth(month, +1)}${currencySuffix}`

  // Empty state: split the `none` variant into welcome (first time ever) vs.
  // month-vacío (has history elsewhere). Only one extra query, cheap.
  let emptyTitle: string | undefined
  let emptyBody: string | undefined
  let emptyCta: string | undefined
  if (emptyVariant === 'none' && movementsPage.movements.length === 0) {
    const hasAny = await hasAnyTransaction()
    if (hasAny) {
      emptyTitle = t('empty.month.title', { month: monthLabel })
      emptyBody = t('empty.month.body')
      emptyCta = t('empty.month.cta')
    } else {
      emptyTitle = t('empty.welcome.title')
      emptyBody = t('empty.welcome.body')
      emptyCta = t('empty.welcome.cta')
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6 pb-24 sm:pb-0">
      <PageHeader
        title={t('title')}
        descriptionExtras={
          <Link
            href="/transactions/recurring"
            className="inline-flex items-center gap-0.5 text-slate hover:opacity-80 transition-opacity font-medium"
          >
            {t('header.see_recurrences')}
            <ChevronRight size={13} className="mt-px" />
          </Link>
        }
        actions={
          <Link
            href="/transactions/new"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            {t('actions.register_movement')}
          </Link>
        }
      />

      {topSuggestion && <RecurrenceSuggestionBanner suggestion={topSuggestion} />}

      <CategorySpendingOverview
        monthLabel={monthLabel}
        prevHref={overviewPrevHref}
        nextHref={overviewNextHref}
        currency={overviewCurrency}
        breakdown={overviewBreakdown}
        hasUsd={hasUsd}
        arsHref={`/transactions?month=${month}`}
        usdHref={`/transactions?month=${month}&currency=USD`}
        month={month}
        getHref={overviewGetHref}
        subBreakdownsByCategory={breakdownMode === 'category' ? subBreakdownsByCategory : undefined}
        labels={{
          eyebrow:
            activeCategory != null
              ? t('spending.eyebrow_in_category', { category: activeCategory.name })
              : t('spending.eyebrow'),
          centerLabel: t('spending.center_label'),
          categoriesCaptionTemplate: t.raw('spending.categories_caption') as string,
          offLedgerNote: t('spending.off_ledger_note'),
          seeDetail: t('spending.see_detail'),
          othersLabelTemplate: t.raw('spending.others_label') as string,
          seeAllCategories: t('spending.see_all_categories'),
          emptyMessage: t('spending.empty'),
        }}
        // No `detailHref` until there's a real drill-down destination.
      />

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <PendingReimbursementsBlock
        pending={pendingReimbursements}
        todayISO={formatDateISO(getTodayAR())}
      />

      <div id="movement-list" className="scroll-mt-6 flex flex-col gap-6">
        <MovementFilters
          filters={filters}
          accounts={filterOptions.accounts}
          categories={filterOptions.categories}
          subcategories={filterOptions.subcategories}
          showAccount={showAccount}
          showMonthNav={false}
        />

        <Suspense fallback={<MovementListSkeleton />}>
        <MovementList
          movements={movementsPage.movements}
          perspective={{ kind: 'global' }}
          todayISO={formatDateISO(getTodayAR())}
          showAccount={showAccount}
          recurrenceLinkedIds={recurrenceLinkedIds}
          emptyState={{
            variant: emptyVariant,
            query: filters.query,
            addHref: '/transactions/new',
            clearHref:
              emptyVariant === 'filter'
                ? buildFiltersClearedHref('/transactions', resolvedSearchParams)
                : emptyVariant === 'search'
                  ? buildSearchClearedHref('/transactions', resolvedSearchParams)
                  : undefined,
            title: emptyTitle,
            body: emptyBody,
            cta: emptyCta,
          }}
        />
        </Suspense>
      </div>

      {movementsPage.hasMore && (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link href={buildMovementLimitHref(resolvedSearchParams, movementsPage.nextLimit)}>
              {tCommon('load_more')}
            </Link>
          </Button>
        </div>
      )}

      <QuickAddFab />
    </div>
  )
}

export default TransactionsPage
