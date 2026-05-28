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
  const tRec = await getTranslations('recurrences')
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
  // warning when confirming a pending recurrence). Only needed when there are
  // pending instances. Credit cards are off-ledger and never warn.
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
  // ARS is the default lens; USD is an explicit `?currency=USD` (shared with the
  // list filter, so the whole page reads in the chosen currency).
  const overviewCurrency: 'ARS' | 'USD' = filters.currency === 'USD' ? 'USD' : 'ARS'
  const overviewBreakdown = overviewCurrency === 'USD' ? usdBreakdown : arsBreakdown
  const curSuffix = overviewCurrency === 'USD' ? '&currency=USD' : ''

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/transactions/recurring">{tRec('title')}</Link>
            </Button>
            <Button asChild>
              <Link href="/transactions/new">{t('actions.register_movement')}</Link>
            </Button>
          </div>
        }
      />

      {topSuggestion && (
        <RecurrenceSuggestionBanner suggestion={topSuggestion} />
      )}

      <CategorySpendingOverview
        title={t('spending.title')}
        monthLabel={monthLabel}
        prevHref={`/transactions?month=${shiftMonth(month, -1)}${curSuffix}`}
        nextHref={`/transactions?month=${shiftMonth(month, 1)}${curSuffix}`}
        emptyLabel={t('spending.empty')}
        currency={overviewCurrency}
        breakdown={overviewBreakdown}
        hasUsd={usdBreakdown.slices.length > 0}
        arsHref={`/transactions?month=${month}`}
        usdHref={`/transactions?month=${month}&currency=USD`}
        month={month}
      />

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <PendingReimbursementsBlock
        pending={pendingReimbursements}
        todayISO={formatDateISO(getTodayAR())}
      />

      <MovementFilters
        filters={filters}
        accounts={filterOptions.accounts}
        categories={filterOptions.categories}
        showAccount={showAccount}
        showMonthNav={false}
      />

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
        }}
      />

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
