import { MovementFilters } from '@/lib/transactions/components/movement-filters'
import { GlobalMovementList } from '@/lib/transactions/components/global-movement-list'
import { parseMovementFilters } from '@/lib/transactions/filters'
import { getGlobalMovements, getMovementFilterOptions } from '@/lib/transactions/queries'

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: Promise<SearchParams>
}

const TransactionsPage = async ({ searchParams }: Props) => {
  const filters = parseMovementFilters(await searchParams)
  const [movements, filterOptions] = await Promise.all([
    getGlobalMovements({ limit: 50, filters }),
    getMovementFilterOptions(),
  ])

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Tus movimientos</p>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Historial cronológico de ingresos, gastos, transferencias, ajustes y consumos.
        </p>
      </div>

      <MovementFilters
        filters={filters}
        accounts={filterOptions.accounts}
        categories={filterOptions.categories}
      />

      <GlobalMovementList movements={movements} />
    </div>
  )
}

export default TransactionsPage
