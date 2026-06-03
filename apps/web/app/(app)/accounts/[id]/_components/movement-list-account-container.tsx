'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  computeRunningBalances,
  type RunningBalanceRow,
} from '@grana/money-logic'
import { MovementList } from '@/lib/transactions/components/movement-list'
import { MovementListSkeleton } from '@/lib/transactions/components/movement-list-skeleton'
import { Button } from '@/components/ui/button'
import { formatDateISO, getTodayAR } from '@/lib/date'
import {
  getAccountDetailAction,
  getAccountMovementsAscendingAction,
  getRecurrenceLinkedTransactionIdsAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import {
  hasActiveContentFilters,
  hasActiveSearch,
  type TransactionsFilters,
} from '@/lib/transactions/filters-state'
import {
  movementMatchesText,
  SUBCATEGORY_NONE_MARKER,
} from '@/lib/transactions/filters'
import { toFinancialMovement, type FinancialMovement } from '@/lib/transactions/movements'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'

type Props = {
  accountId: string
}

/** Empty-state variant: which message + action to show when the visible list is empty. */
function resolveEmptyVariant(filters: TransactionsFilters): 'none' | 'search' | 'filter' {
  if (hasActiveContentFilters(filters)) return 'filter'
  if (hasActiveSearch(filters)) return 'search'
  return 'none'
}

/**
 * Apply the user-facing filters to the account's movement history in display
 * order (most-recent first). Mirrors the in-memory filtering the legacy
 * `page.tsx` used to do server-side; doing it client-side avoids a second
 * server roundtrip (the ascending history is already loaded for the running
 * balance).
 */
function applyAccountFilters(
  movements: FinancialMovement[],
  filters: TransactionsFilters,
  range: { from?: string; to?: string },
): FinancialMovement[] {
  return movements.filter((m) => {
    if (range.from && m.date < range.from) return false
    if (range.to && m.date > range.to) return false
    if (filters.type && m.kind !== filters.type) return false
    if (filters.currency && m.currency_code !== filters.currency) return false
    if (filters.categoryId && m.category_id !== filters.categoryId) return false
    if (filters.subcategoryId) {
      if (filters.subcategoryId === SUBCATEGORY_NONE_MARKER) {
        if (m.subcategory_id) return false
      } else if (m.subcategory_id !== filters.subcategoryId) {
        return false
      }
    }
    if (filters.amountMin != null && m.amount < filters.amountMin) return false
    if (filters.amountMax != null && m.amount > filters.amountMax) return false
    if (filters.query && !movementMatchesText(m, filters.query)) return false
    return true
  })
}

/**
 * Resolve the date range for the current filter state. Custom range wins;
 * otherwise the month boundaries.
 */
function resolveRange(filters: TransactionsFilters): { from?: string; to?: string } {
  if (filters.customRange) {
    return {
      from: filters.customRange.from,
      to: filters.customRange.to,
    }
  }
  const [yy, mm] = filters.month.split('-').map(Number)
  const from = `${filters.month}-01`
  const to = formatDateISO(new Date(yy, mm, 0)) // day 0 of next month = last of current
  return { from, to }
}

/**
 * Client container for the account-scoped movement list. One server query
 * loads the full ascending history (the running balance source); the visible
 * page is derived client-side from the same dataset via filter + slice. The
 * running balance is computed once over the unfiltered history and shown only
 * when there are no content filters active (filters skip rows ⇒ a per-row
 * running balance would be misleading).
 */
export function MovementListAccountContainer({ accountId }: Props) {
  const { filters, dispatch } = useTransactionsFilters()
  const tCommon = useTranslations('common')

  const [ascendingQ, accountQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
        queryFn: () => getAccountMovementsAscendingAction(accountId),
      },
      {
        queryKey: QUERY_KEYS.accountDetail(accountId),
        queryFn: () => getAccountDetailAction(accountId),
      },
    ],
  })

  // Running balance: needs the FULL ascending history + the account's per-currency
  // initial balances. Both come from cached queries; recompute only when one changes.
  const runningBalances = useMemo(() => {
    if (!ascendingQ.data || !accountQ.data) return null
    const account = accountQ.data
    const initial = {
      ARS: Number(
        account.currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0,
      ),
      USD: Number(
        account.currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0,
      ),
    }
    return computeRunningBalances(
      ascendingQ.data as RunningBalanceRow[],
      accountId,
      initial,
    )
  }, [ascendingQ.data, accountQ.data, accountId])

  // Display order (most recent first) + user filters + client-side pagination.
  const allDisplayMovements = useMemo<FinancialMovement[]>(() => {
    if (!ascendingQ.data) return []
    return ascendingQ.data.map(toFinancialMovement).reverse()
  }, [ascendingQ.data])

  const range = useMemo(() => resolveRange(filters), [filters])

  const filteredMovements = useMemo(
    () => applyAccountFilters(allDisplayMovements, filters, range),
    [allDisplayMovements, filters, range],
  )

  const pagedMovements = useMemo(
    () => filteredMovements.slice(0, filters.limit),
    [filteredMovements, filters.limit],
  )
  const hasMore = filteredMovements.length > pagedMovements.length

  const movementIds = useMemo(() => pagedMovements.map((m) => m.id), [pagedMovements])

  const linkedQ = useQuery({
    queryKey: QUERY_KEYS.transactionsLinkedRecurrenceIds(movementIds),
    queryFn: () => getRecurrenceLinkedTransactionIdsAction(movementIds),
    enabled: movementIds.length > 0,
  })

  if (ascendingQ.isPending) return <MovementListSkeleton />
  if (ascendingQ.error || !ascendingQ.data) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No pudimos cargar los movimientos. Recargá para reintentar.
      </div>
    )
  }

  const variant = resolveEmptyVariant(filters)
  const recurrenceLinkedIds = linkedQ.data ? new Set(linkedQ.data) : undefined
  const showRunningBalance = !hasActiveContentFilters(filters) ? runningBalances : null

  return (
    <div id="movement-list" className="scroll-mt-6 flex flex-col gap-6">
      <MovementList
        movements={pagedMovements}
        perspective={{ kind: 'account', accountId }}
        todayISO={formatDateISO(getTodayAR())}
        showAccount={false}
        recurrenceLinkedIds={recurrenceLinkedIds}
        runningBalances={showRunningBalance}
        emptyState={{
          variant,
          query: filters.query,
          addHref: `/transactions/new?account=${accountId}&from=account:${accountId}`,
          onClear:
            variant === 'filter'
              ? () => dispatch({ type: 'clearFilters' })
              : variant === 'search'
                ? () => dispatch({ type: 'clearSearch' })
                : undefined,
          // Welcome / month-empty differentiation requires a separate "has any
          // ever" probe; the legacy /accounts/[id] never offered it either,
          // so the MovementList component's default copy applies.
        }}
      />

      {hasMore && (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault()
                dispatch({ type: 'incrementLimit' })
              }}
            >
              {tCommon('load_more')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
