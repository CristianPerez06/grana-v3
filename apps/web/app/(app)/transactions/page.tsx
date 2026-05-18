import { getGlobalMovements } from '@/lib/transactions/queries'
import { GlobalMovementList } from '@/lib/transactions/components/global-movement-list'

const TransactionsPage = async () => {
  const movements = await getGlobalMovements({ limit: 50 })

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Tus movimientos</p>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Historial cronológico de ingresos, gastos, transferencias, ajustes y consumos.
        </p>
      </div>

      <GlobalMovementList movements={movements} />
    </div>
  )
}

export default TransactionsPage
