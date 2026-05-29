import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { buildCategorySlices } from '@grana/money-logic'
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
  getMovementFilterOptions,
  getPendingReimbursements,
  hasAnyTransaction,
  UNCATEGORIZED_ID,
} from '@/lib/transactions/queries'
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
      getMovementFilterOptions(),
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

  // Carta de presentación: gastos por categoría del mes (donut + ranking).
  const month = filters.month ?? monthOf(getTodayAR())
  const breakdown = await getMonthCategoryBreakdown(month)
  const locale = await getLocale()
  const [yy, mm] = month.split('-').map(Number)
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )
  const fillLabels = (inputs: typeof breakdown.ARS) =>
    inputs.map((i) =>
      i.categoryId === UNCATEGORIZED_ID ? { ...i, label: t('spending.uncategorized') } : i,
    )
  const arsBreakdown = buildCategorySlices(fillLabels(breakdown.ARS), {
    othersLabel: t('spending.others'),
  })
  const usdBreakdown = buildCategorySlices(fillLabels(breakdown.USD), {
    othersLabel: t('spending.others'),
  })
  const overviewCurrency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'
  const overviewBreakdown = overviewCurrency === 'USD' ? usdBreakdown : arsBreakdown

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
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={t('title')} />

      {topSuggestion && <RecurrenceSuggestionBanner suggestion={topSuggestion} />}

      <CategorySpendingOverview
        monthLabel={monthLabel}
        prevHref={overviewPrevHref}
        nextHref={overviewNextHref}
        currency={overviewCurrency}
        breakdown={overviewBreakdown}
        hasUsd={usdBreakdown.slices.length > 0}
        arsHref={`/transactions?month=${month}`}
        usdHref={`/transactions?month=${month}&currency=USD`}
        month={month}
        labels={{
          eyebrow: t('spending.eyebrow'),
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
