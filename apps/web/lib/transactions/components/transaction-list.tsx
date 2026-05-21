import type { TransactionWithDetails } from '../types'
import Link from 'next/link'

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type RowMeta = {
  label: string
  secondaryLabel: string | null
  sign: '+' | '-'
  colorClass: string
  amount: number
}

function getRowMeta(tx: TransactionWithDetails, currentAccountId: string): RowMeta {
  const absAmount = Math.abs(tx.amount)

  if (tx.type === 'income') {
    return {
      label: tx.category?.name ?? 'Ingreso',
      secondaryLabel: tx.description ?? null,
      sign: '+',
      colorClass: 'text-green-600',
      amount: absAmount,
    }
  }

  if (tx.type === 'expense') {
    // Card payment expenses (the expense created by payCardPeriod) link to a
    // period_payments row. They have no category and their description is the
    // authoritative label, so show it as the primary text instead of "Gasto".
    const isCardPayment = Array.isArray(tx.period_payments) && tx.period_payments.length > 0
    if (isCardPayment) {
      return {
        label: tx.description ?? 'Pago de tarjeta',
        secondaryLabel: null,
        sign: '-',
        colorClass: 'text-foreground',
        amount: absAmount,
      }
    }
    return {
      label: tx.category?.name ?? 'Gasto',
      secondaryLabel: tx.description ?? null,
      sign: '-',
      colorClass: 'text-foreground',
      amount: absAmount,
    }
  }

  if (tx.type === 'transfer') {
    const isOutgoing = tx.account_id === currentAccountId
    const secondaryLabel = isOutgoing
      ? `→ ${tx.destination_account?.name ?? 'Cuenta destino'}`
      : `← ${tx.source_account?.name ?? 'Cuenta origen'}`

    return {
      label: 'Transferencia',
      secondaryLabel: tx.description ?? secondaryLabel,
      sign: isOutgoing ? '-' : '+',
      colorClass: isOutgoing ? 'text-foreground' : 'text-green-600',
      amount: absAmount,
    }
  }

  // adjustment
  const isPositive = tx.amount > 0
  return {
    label: 'Ajuste',
    secondaryLabel: tx.description ?? null,
    sign: isPositive ? '+' : '-',
    colorClass: isPositive ? 'text-green-600' : 'text-foreground',
    amount: absAmount,
  }
}

type Props = {
  transactions: TransactionWithDetails[]
  accountId: string
}

export const TransactionList = ({ transactions, accountId }: Props) => {
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium text-foreground">Todavía no hay movimientos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrá tu primer ingreso o gasto en esta cuenta.
        </p>
        <Link
          href={`/accounts/${accountId}/transactions/new`}
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          + Agregar movimiento
        </Link>
      </div>
    )
  }

  // Group by date
  const grouped = new Map<string, TransactionWithDetails[]>()
  for (const tx of transactions) {
    const existing = grouped.get(tx.date) ?? []
    existing.push(tx)
    grouped.set(tx.date, existing)
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([date, txs]) => (
        <div key={date}>
          <p className="mb-2 text-xs font-medium text-muted-foreground capitalize">
            {formatDate(date)}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {txs.map((tx) => {
              const meta = getRowMeta(tx, accountId)
              return (
                <Link
                  key={tx.id}
                  href={`/accounts/${accountId}/transactions/${tx.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate">{meta.label}</span>
                    {meta.secondaryLabel && (
                      <span className="text-xs text-muted-foreground truncate">
                        {meta.secondaryLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 ml-4">
                    <span className={`text-sm font-semibold tabular-nums ${meta.colorClass}`}>
                      {meta.sign}
                      {new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: tx.currency_code,
                        minimumFractionDigits: 2,
                      }).format(meta.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{tx.currency_code}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
