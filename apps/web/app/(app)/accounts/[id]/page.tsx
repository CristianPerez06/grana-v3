import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { computeRunningBalances, type RunningBalanceRow } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAccountMovements, getMovementFilterOptions } from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import {
  buildFiltersClearedHref,
  buildSearchClearedHref,
  hasContentFilters,
  movementMatchesText,
  parseMovementFilters,
  resolveEmptyVariant,
} from '@/lib/transactions/filters'
import { MovementList } from '@/lib/transactions/components/movement-list'
import { MovementFilters } from '@/lib/transactions/components/movement-filters'
import { getRecurrenceLinkedTransactionIds } from '@/lib/recurrences/queries'
import { getTodayAR, formatDateISO } from '@/lib/date'
import { AccountDetailHeader } from './_components/account-detail-header'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const AccountDetailPage = async ({ params, searchParams }: Props) => {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const filters = parseMovementFilters(resolvedSearchParams)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('accounts')

  const [account, movementsAsc, filterOptions] = await Promise.all([
    getAccountDetail(id),
    getAccountMovements(id),
    getMovementFilterOptions(),
  ])
  if (!account) notFound()
  if (account.type === 'credit') redirect(`/cards/${id}`)

  // Running balance from the full history (ascending), per currency.
  const initial = {
    ARS: Number(account.currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0),
    USD: Number(account.currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0),
  }
  const runningBalances = computeRunningBalances(movementsAsc as RunningBalanceRow[], id, initial)

  // Display order is most-recent-first, then apply month + filters.
  const allMovements = movementsAsc.map(toFinancialMovement).reverse()
  const movements = allMovements.filter((m) => {
    if (filters.from && m.date < filters.from) return false
    if (filters.to && m.date > filters.to) return false
    if (filters.type && m.kind !== filters.type) return false
    if (filters.currency && m.currency_code !== filters.currency) return false
    if (filters.categoryId && m.category_id !== filters.categoryId) return false
    if (filters.amountMin != null && m.amount < filters.amountMin) return false
    if (filters.amountMax != null && m.amount > filters.amountMax) return false
    if (filters.query && !movementMatchesText(m, filters.query)) return false
    return true
  })

  // Content filters skip rows → a running balance would mislead; month/currency don't.
  const showRunningBalance = !hasContentFilters(filters)
  const recurrenceLinkedIds = await getRecurrenceLinkedTransactionIds(movements.map((m) => m.id))

  const inactiveCurrencies = account.currencies.filter((c) => !c.is_active)
  const allCurrencyCodes = new Set(account.currencies.map((c) => c.currency_code))
  const canAddCurrency =
    !allCurrencyCodes.has('ARS') ||
    !allCurrencyCodes.has('USD') ||
    inactiveCurrencies.length > 0

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {`← ${t('title')}`}
        </Link>
      </div>

      <AccountDetailHeader account={account} hasTransactions={allMovements.length > 0} />

      {canAddCurrency && (
        <Link
          href={`/accounts/${account.id}/edit`}
          className="self-start text-sm text-primary hover:underline"
        >
          {`+ ${t('actions.addCurrency')}`}
        </Link>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t('headers.movements')}
          </h2>
          <Link
            href={`/transactions/new?account=${account.id}&from=account:${account.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {`+ ${t('actions.add_transaction')}`}
          </Link>
        </div>

        <MovementFilters
          filters={filters}
          accounts={filterOptions.accounts}
          categories={filterOptions.categories}
          isExpert={false}
          showAccountFilter={false}
        />

        <MovementList
          movements={movements}
          perspective={{ kind: 'account', accountId: account.id }}
          todayISO={formatDateISO(getTodayAR())}
          showAccount={false}
          recurrenceLinkedIds={recurrenceLinkedIds}
          runningBalances={showRunningBalance ? runningBalances : null}
          emptyState={{
            variant: resolveEmptyVariant(filters),
            query: filters.query,
            addHref: `/transactions/new?account=${id}&from=account:${id}`,
            clearHref:
              resolveEmptyVariant(filters) === 'filter'
                ? buildFiltersClearedHref(`/accounts/${id}`, resolvedSearchParams)
                : resolveEmptyVariant(filters) === 'search'
                  ? buildSearchClearedHref(`/accounts/${id}`, resolvedSearchParams)
                  : undefined,
          }}
        />
      </section>
    </div>
  )
}

export default AccountDetailPage
