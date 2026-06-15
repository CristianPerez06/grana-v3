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
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAccountMovementsAscending } from '@/lib/transactions/queries'
import { getRecurrenceLinkedTransactionIds } from '@/lib/recurrences/queries'
import { createClient } from '@/lib/supabase/client'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import {
  hasActiveContentFilters,
  hasActiveSearch,
  type TransactionsFilters,
} from '@/lib/transactions/filters-state'
import {
  movementMatchesText,
  SUBCATEGORY_NONE_MARKER,
} from '@/lib/transactions/filters'
import {
  INITIAL_BALANCE_ID_PREFIX,
  isInitialBalanceMovement,
  toFinancialMovement,
  toInitialBalanceMovement,
  type FinancialMovement,
} from '@/lib/transactions/movements'
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
  const drawer = useMovementDrawer()
  const tCommon = useTranslations('common')
  const tAccounts = useTranslations('accounts')

  const [ascendingQ, accountQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.accountMovementsAscending(accountId),
        queryFn: () => getAccountMovementsAscending(createClient(), accountId),
      },
      {
        queryKey: QUERY_KEYS.accountDetail(accountId),
        queryFn: () => getAccountDetail(createClient(), accountId),
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
    const snapshots = computeRunningBalances(
      ascendingQ.data as RunningBalanceRow[],
      accountId,
      initial,
    )
    // The synthetic "saldo inicial" rows snapshot the starting balance itself
    // (their row displays the per-currency value before any movement).
    for (const c of account.currencies) {
      if (Number(c.initial_balance) === 0) continue
      snapshots.set(`${INITIAL_BALANCE_ID_PREFIX}${c.currency_code}`, initial)
    }
    return snapshots
  }, [ascendingQ.data, accountQ.data, accountId])

  // Display order (most recent first) + user filters + client-side pagination.
  // The per-currency "saldo inicial" is injected here as a synthetic row (it is
  // NOT a transaction), so it only ever exists in this account-scoped list.
  const allDisplayMovements = useMemo<FinancialMovement[]>(() => {
    if (!ascendingQ.data) return []
    const ascending = ascendingQ.data.map(toFinancialMovement)
    const account = accountQ.data
    if (account) {
      for (const c of account.currencies) {
        const initialBalance = Number(c.initial_balance)
        if (initialBalance === 0) continue
        ascending.push(
          toInitialBalanceMovement({
            accountId,
            accountName: account.name,
            currencyCode: c.currency_code,
            initialBalance,
            date: c.initial_balance_date,
            createdAt: c.created_at,
            label: tAccounts('labels.initialBalance'),
          }),
        )
      }
      // Re-establish calculation order (the server already sorts the real
      // rows; the synthetic ones land by date + created_at, stable otherwise).
      ascending.sort((a, b) =>
        a.date === b.date
          ? a.created_at.localeCompare(b.created_at)
          : a.date.localeCompare(b.date),
      )
    }
    return ascending.reverse()
  }, [ascendingQ.data, accountQ.data, accountId, tAccounts])

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

  // Synthetic rows are not transactions — their ids must never reach the
  // server (the recurrence lookup casts them to uuid).
  const movementIds = useMemo(
    () => pagedMovements.filter((m) => !isInitialBalanceMovement(m)).map((m) => m.id),
    [pagedMovements],
  )

  const linkedQ = useQuery({
    queryKey: QUERY_KEYS.transactionsLinkedRecurrenceIds(movementIds),
    queryFn: () => getRecurrenceLinkedTransactionIds(createClient(), movementIds),
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
          onAdd: drawer ? () => drawer.openCreate(accountId) : undefined,
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
