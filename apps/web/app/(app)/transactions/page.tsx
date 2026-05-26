import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR, formatDateISO } from '@/lib/date'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { MovementFilters } from '@/lib/transactions/components/movement-filters'
import { MovementList } from '@/lib/transactions/components/movement-list'
import {
  buildFiltersClearedHref,
  buildMovementLimitHref,
  buildSearchClearedHref,
  parseMovementFilters,
  parseMovementLimit,
  resolveEmptyVariant,
} from '@/lib/transactions/filters'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { getGlobalMovementsPage, getMovementFilterOptions } from '@/lib/transactions/queries'
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('mode')
    .eq('id', user.id)
    .single()
  const showAccount = profile?.mode === 'experto'

  const resolvedSearchParams = await searchParams
  const filters = parseMovementFilters(resolvedSearchParams)
  const emptyVariant = resolveEmptyVariant(filters)
  const limit = parseMovementLimit(resolvedSearchParams)
  const t = await getTranslations('transactions')
  const tRec = await getTranslations('recurrences')
  const tCommon = await getTranslations('common')

  // Generación lazy de instancias recurrentes: una pasada por carga de página.
  await generateDueRecurrenceInstances()

  const [movementsPage, filterOptions, pendingRecurrences, topSuggestion] =
    await Promise.all([
      getGlobalMovementsPage({ limit, filters }),
      getMovementFilterOptions(),
      getPendingRecurrenceInstances(),
      getTopRecurrenceSuggestion(),
    ])

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

      <PendingRecurrencesBlock
        pending={pendingRecurrences}
        availableByAccount={availableByAccount}
      />

      <MovementFilters
        filters={filters}
        accounts={filterOptions.accounts}
        categories={filterOptions.categories}
        isExpert={showAccount}
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
