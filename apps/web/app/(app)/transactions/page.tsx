import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { MovementFilters } from '@/lib/transactions/components/movement-filters'
import { GlobalMovementList } from '@/lib/transactions/components/global-movement-list'
import {
  buildMovementLimitHref,
  parseMovementFilters,
  parseMovementLimit,
} from '@/lib/transactions/filters'
import { getGlobalMovementsPage, getMovementFilterOptions } from '@/lib/transactions/queries'
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
  const resolvedSearchParams = await searchParams
  const filters = parseMovementFilters(resolvedSearchParams)
  const limit = parseMovementLimit(resolvedSearchParams)

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

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Movimientos"
        description="Historial cronológico de ingresos, gastos, transferencias, ajustes y consumos."
        actions={
          <Button asChild variant="secondary">
            <Link href="/transactions/recurring">Recurrencias</Link>
          </Button>
        }
      />

      {topSuggestion && (
        <RecurrenceSuggestionBanner suggestion={topSuggestion} />
      )}

      <PendingRecurrencesBlock pending={pendingRecurrences} />

      <MovementFilters
        filters={filters}
        accounts={filterOptions.accounts}
        categories={filterOptions.categories}
      />

      <GlobalMovementList
        movements={movementsPage.movements}
        recurrenceLinkedIds={recurrenceLinkedIds}
      />

      {movementsPage.hasMore && (
        <div className="flex justify-center">
          <Button asChild variant="secondary">
            <Link href={buildMovementLimitHref(resolvedSearchParams, movementsPage.nextLimit)}>
              Cargar más
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export default TransactionsPage
