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
  hasUsdActivityInMonth,
  getMonthCategoryBreakdown,
  getMonthIncomeBreakdown,
  getMonthSubcategoryBreakdown,
  getMovementFilterOptions,
  getPendingReimbursements,
  hasAnyTransaction,
  UNCATEGORIZED_ID,
} from '@/lib/transactions/queries'
import type { CategoryBreakdown, SubcategoryBreakdown } from '@grana/money-logic'
import { SUBCATEGORY_NONE_MARKER } from '@/lib/transactions/filters'
import { getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { MovementDrawerProvider } from './_components/movement-drawer'
import type { MovementFormAccount } from './new/_components/movement-form'
import { RegisterMovementButton } from '@/lib/transactions/components/register-movement-button'
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

const activeCodes = (
  currencies: Array<{ currency_code: string; is_active: boolean }>,
): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

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

  // Overview mode (design handoff: selector Egresos / Ingresos). URL-driven like
  // the currency toggle; defaults to egresos. Income is a flat by-category view.
  const rawOverview = Array.isArray(resolvedSearchParams.overview)
    ? resolvedSearchParams.overview[0]
    : resolvedSearchParams.overview
  const overviewMode: 'egresos' | 'ingresos' = rawOverview === 'ingresos' ? 'ingresos' : 'egresos'

  // Mode resolution: when the user filtered to exactly one category (and didn't
  // narrow further to a subcategory), the donut switches to in-category mode.
  // With a subcategory also filtered, the donut would be "100% in X" — pointless
  // — so it falls back to the category mode (which renders the single parent
  // category as a full donut, coherent with the rest of the module). The
  // in-category subcategory drill is an expenses-only feature, so it never
  // applies in the income view.
  const breakdownMode: 'category' | 'subcategory' =
    overviewMode === 'egresos' && filters.categoryId && !filters.subcategoryId
      ? 'subcategory'
      : 'category'

  const overviewCurrency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'

  // Active-mode data: the donut renders a single CategoryBreakdown. Egresos
  // keeps the existing expense logic (in-category subcategory drill-down + the
  // pre-fetched sub-breakdowns); ingresos shows income by category — a flat
  // ranking, green palette, no drill-down (per the design handoff). Labels are
  // resolved here (i18n).
  let overviewBreakdown: CategoryBreakdown
  // Currency toggle visibility is decided per-month (not per-mode) so it stays
  // put when the user switches between Egresos and Ingresos.
  const hasUsd = await hasUsdActivityInMonth(month)
  // Parent category id when the donut is in the expenses in-category subcategory
  // mode; the component uses it to build drill-in hrefs (serializable, no fn).
  let overviewParentCategoryId: string | undefined
  let activeCategory: { id: string; name: string } | null = null
  let subBreakdownsByCategory:
    | Record<string, { ARS: SubcategoryBreakdown; USD: SubcategoryBreakdown }>
    | undefined

  if (overviewMode === 'ingresos') {
    const incomeRaw = await getMonthIncomeBreakdown(month)
    const fillIncomeLabels = (inputs: typeof incomeRaw.ARS) =>
      inputs.map((i) =>
        i.categoryId === UNCATEGORIZED_ID ? { ...i, label: t('spending.uncategorized') } : i,
      )
    const arsIncome = buildCategorySlices(fillIncomeLabels(incomeRaw.ARS), {
      othersLabel: t('spending.others'),
    })
    const usdIncome = buildCategorySlices(fillIncomeLabels(incomeRaw.USD), {
      othersLabel: t('spending.others'),
    })
    overviewBreakdown = overviewCurrency === 'USD' ? usdIncome : arsIncome
    // Income row hrefs are built inside the component (mode === 'ingresos').
  } else {
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

    activeCategory =
      breakdownMode === 'subcategory' && filters.categoryId
        ? filterOptions.categories.find((c) => c.id === filters.categoryId) ?? null
        : null

    overviewBreakdown = overviewCurrency === 'USD' ? usdCategoryBreakdown : arsCategoryBreakdown

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
      // Drill-down: the component builds row hrefs from this parent id.
      overviewParentCategoryId = filters.categoryId
    }

    // Pre-fetch subcategory breakdowns for all drillable top-level categories so
    // the spending overview can animate the drill-in in situ without a round-trip.
    const drillableCategoryIds = arsCategoryBreakdown.slices
      .filter((s) => s.categoryId !== null)
      .map((s) => s.categoryId!)

    if (drillableCategoryIds.length > 0 && breakdownMode === 'category') {
      const prefetched: Record<string, { ARS: SubcategoryBreakdown; USD: SubcategoryBreakdown }> = {}
      const rawPairs = await Promise.all(
        drillableCategoryIds.map((catId) => getMonthSubcategoryBreakdown(month, catId)),
      )
      drillableCategoryIds.forEach((catId, i) => {
        const raw = rawPairs[i]
        prefetched[catId] = {
          ARS: buildSubcategorySlices(raw.ARS),
          USD: buildSubcategorySlices(raw.USD),
        }
      })
      subBreakdownsByCategory = prefetched
    }
  }

  // The month nav lives in the spending overview card below. The page header
  // stays minimalist: just the title and the recurrences shortcut in the
  // actions slot.
  const currencySuffix = overviewCurrency === 'USD' ? '&currency=USD' : ''
  const overviewSuffix = overviewMode === 'ingresos' ? '&overview=ingresos' : ''
  const overviewPrevHref = `/transactions?month=${shiftMonth(month, -1)}${currencySuffix}${overviewSuffix}`
  const overviewNextHref = `/transactions?month=${shiftMonth(month, +1)}${currencySuffix}${overviewSuffix}`
  // Mode selector hrefs preserve the current currency; the currency toggle
  // hrefs (below) preserve the current mode.
  const egresosHref = `/transactions?month=${month}${currencySuffix}`
  const ingresosHref = `/transactions?month=${month}${currencySuffix}&overview=ingresos`

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

  // Drawer data: full account set (incl. credit) + category tree, reused by the
  // in-context create form. The /transactions/new page remains the fallback.
  const [
    { cash: drawerCash, bank: drawerBank, credit: drawerCredit },
    drawerCategories,
  ] = await Promise.all([getAccounts(), getAllCategories(user.id)])
  const drawerAccounts: MovementFormAccount[] = [
    ...[...drawerCash, ...drawerBank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      balances: a.balances,
      institutionId: a.institution_id ?? null,
      avatar: a.avatar,
    })),
    ...drawerCredit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
      balances: { ARS: 0, USD: 0 },
      institutionId: c.institution_id ?? null,
    })),
  ]

  return (
    <MovementDrawerProvider accounts={drawerAccounts} categories={drawerCategories}>
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
        actions={<RegisterMovementButton />}
      />

      {topSuggestion && <RecurrenceSuggestionBanner suggestion={topSuggestion} />}

      <CategorySpendingOverview
        monthLabel={monthLabel}
        prevHref={overviewPrevHref}
        nextHref={overviewNextHref}
        currency={overviewCurrency}
        mode={overviewMode}
        egresosHref={egresosHref}
        ingresosHref={ingresosHref}
        breakdown={overviewBreakdown}
        hasUsd={hasUsd}
        arsHref={`/transactions?month=${month}${overviewSuffix}`}
        usdHref={`/transactions?month=${month}&currency=USD${overviewSuffix}`}
        month={month}
        parentCategoryId={overviewParentCategoryId}
        subBreakdownsByCategory={subBreakdownsByCategory}
        labels={{
          eyebrow:
            overviewMode === 'ingresos'
              ? t('spending.income_eyebrow')
              : activeCategory != null
                ? t('spending.eyebrow_in_category', { category: activeCategory.name })
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
    </MovementDrawerProvider>
  )
}

export default TransactionsPage
