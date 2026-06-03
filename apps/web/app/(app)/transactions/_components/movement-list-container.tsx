'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery, useQueries } from '@tanstack/react-query'
import { MovementList } from '@/lib/transactions/components/movement-list'
import { MovementListSkeleton } from '@/lib/transactions/components/movement-list-skeleton'
import { Button } from '@/components/ui/button'
import { formatDateISO, getTodayAR } from '@/lib/date'
import {
  getMovementsPageAction,
  getRecurrenceLinkedTransactionIdsAction,
  hasAnyTransactionAction,
} from '@/app/_actions/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import {
  adaptFiltersForQuery,
  hasActiveContentFilters,
  hasActiveSearch,
  type TransactionsFilters,
} from '@/lib/transactions/filters-state'
import { useTransactionsFilters } from '@/lib/transactions/filters-context'

function resolveEmptyVariant(filters: TransactionsFilters): 'none' | 'search' | 'filter' {
  if (hasActiveContentFilters(filters)) return 'filter'
  if (hasActiveSearch(filters)) return 'search'
  return 'none'
}

/**
 * Client container for `<MovementList>` plus the "Load more" action and the
 * empty-state variant resolution. Reads filters from React state, queries the
 * paginated list + linked recurrence ids + has-any-ever signal, and renders
 * the list with empty-state callbacks wired to the filter reducer.
 */
export function MovementListContainer() {
  const { filters, dispatch } = useTransactionsFilters()
  const drawer = useMovementDrawer()
  const tCommon = useTranslations('common')
  const t = useTranslations('transactions')

  const adapted = useMemo(() => adaptFiltersForQuery(filters), [filters])

  // movement page + linked-recurrence-ids in parallel; the latter depends on
  // the movement ids, so it's keyed on the resolved list and chained via
  // `enabled`.
  const [pageQ] = useQueries({
    queries: [
      {
        queryKey: QUERY_KEYS.transactionsPage(filters.limit, adapted),
        queryFn: () =>
          getMovementsPageAction({ limit: filters.limit, filters: adapted }),
      },
    ],
  })

  const movementIds = useMemo(
    () => pageQ.data?.movements.map((m) => m.id) ?? [],
    [pageQ.data],
  )

  const linkedQ = useQuery({
    queryKey: QUERY_KEYS.transactionsLinkedRecurrenceIds(movementIds),
    queryFn: () => getRecurrenceLinkedTransactionIdsAction(movementIds),
    enabled: movementIds.length > 0,
  })

  // hasAny is only needed for the "none" empty variant (welcome vs. month-empty
  // copy). Cached for the session, so this is effectively free after first hit.
  const hasAnyQ = useQuery({
    queryKey: QUERY_KEYS.transactionsHasAny,
    queryFn: () => hasAnyTransactionAction(),
  })

  if (pageQ.isPending) return <MovementListSkeleton />
  if (pageQ.error || !pageQ.data) {
    // Generic inline fallback; group 8 upgrades to <RouteError> with retry.
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No pudimos cargar los movimientos. Recargá para reintentar.
      </div>
    )
  }

  const { movements, hasMore } = pageQ.data
  const variant = resolveEmptyVariant(filters)
  const showAccount = false // sin filter-options aquí; el container de filtros decide

  // Empty-state messaging for the 'none' variant: welcome (first time ever)
  // vs. month-empty (has history in other months).
  let emptyTitle: string | undefined
  let emptyBody: string | undefined
  let emptyCta: string | undefined
  if (variant === 'none' && movements.length === 0) {
    const hasAny = hasAnyQ.data
    if (hasAny === false) {
      emptyTitle = t('empty.welcome.title')
      emptyBody = t('empty.welcome.body')
      emptyCta = t('empty.welcome.cta')
    } else if (hasAny === true) {
      const [yy, mm] = filters.month.split('-').map(Number)
      const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
      })
      emptyTitle = t('empty.month.title', { month: monthLabel })
      emptyBody = t('empty.month.body')
      emptyCta = t('empty.month.cta')
    }
  }

  const recurrenceLinkedIds = linkedQ.data ? new Set(linkedQ.data) : undefined

  return (
    <div id="movement-list" className="scroll-mt-6 flex flex-col gap-6">
      <MovementList
        movements={movements}
        perspective={{ kind: 'global' }}
        todayISO={formatDateISO(getTodayAR())}
        showAccount={showAccount}
        recurrenceLinkedIds={recurrenceLinkedIds}
        emptyState={{
          variant,
          query: filters.query,
          // Open the drawer when available; fall back to /transactions/new.
          onAdd: drawer ? () => drawer.openCreate() : undefined,
          addHref: drawer ? undefined : '/transactions/new',
          onClear:
            variant === 'filter'
              ? () => dispatch({ type: 'clearFilters' })
              : variant === 'search'
                ? () => dispatch({ type: 'clearSearch' })
                : undefined,
          title: emptyTitle,
          body: emptyBody,
          cta: emptyCta,
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
