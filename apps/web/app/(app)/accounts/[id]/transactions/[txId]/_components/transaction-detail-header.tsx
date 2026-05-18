'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { deleteTransaction, deleteTransfer, deleteAdjustment } from '@/app/_actions/transactions'

const formatBalance = (amount: number, currency: 'ARS' | 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const TYPE_LABELS = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
}

type Props = {
  transaction: TransactionWithDetails
  accountId: string
  periodId?: string | null
  installmentParent?: TransactionWithDetails | null
  installmentSiblings?: TransactionWithDetails[] | null
}

export const TransactionDetailHeader = ({ transaction, accountId, periodId, installmentParent, installmentSiblings }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { type } = transaction

  const confirmMessage =
    type === 'transfer'
      ? '¿Eliminar esta transferencia? Se actualizarán los saldos de ambas cuentas.'
      : type === 'adjustment'
        ? '¿Eliminar este ajuste? Esta acción no se puede deshacer.'
        : '¿Eliminar este movimiento? Esta acción no se puede deshacer.'

  const handleDelete = () => {
    if (!confirm(confirmMessage)) return
    startTransition(async () => {
      setError(null)

      let result
      if (type === 'transfer' && transaction.transfer_destination_account_id) {
        result = await deleteTransfer(
          transaction.id,
          accountId,
          transaction.transfer_destination_account_id,
        )
      } else if (type === 'adjustment') {
        result = await deleteAdjustment(transaction.id, accountId)
      } else {
        result = await deleteTransaction(transaction.id, accountId)
      }

      if (!result.ok) {
        setError(result.formError ?? 'Error al eliminar.')
        return
      }
      router.push(periodId ? `/cards/${accountId}/periods/${periodId}` : `/accounts/${accountId}`)
    })
  }

  const isPositive = type === 'income' || (type === 'adjustment' && transaction.amount > 0) ||
    (type === 'transfer' && transaction.account_id !== accountId)
  const displayAmount = Math.abs(transaction.amount)
  const sign = isPositive ? '+' : '-'

  const typeBadgeClass =
    type === 'income'
      ? 'bg-green-100 text-green-700'
      : type === 'adjustment'
        ? 'bg-blue-100 text-blue-700'
        : type === 'transfer'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-muted text-muted-foreground'

  return (
    <div className="flex flex-col gap-6">
      {/* Type badge + amount */}
      <div className="flex flex-col gap-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${typeBadgeClass}`}>
          {TYPE_LABELS[type]}
        </span>
        <p className={`text-3xl font-bold tabular-nums ${isPositive ? 'text-green-600' : ''}`}>
          {sign}{formatBalance(displayAmount, transaction.currency_code)}
        </p>
        <p className="text-sm text-muted-foreground">{transaction.currency_code}</p>
      </div>

      {/* Details */}
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="capitalize">{formatDate(transaction.date)}</dd>
        </div>

        {/* Income/Expense: category */}
        {(type === 'income' || type === 'expense') && transaction.category && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Categoría</dt>
            <dd>{transaction.category.name}</dd>
          </div>
        )}
        {(type === 'income' || type === 'expense') && transaction.subcategory && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subcategoría</dt>
            <dd>{transaction.subcategory.name}</dd>
          </div>
        )}

        {/* Transfer: source and destination accounts */}
        {type === 'transfer' && (
          <>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cuenta origen</dt>
              <dd>{transaction.source_account?.name ?? accountId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cuenta destino</dt>
              <dd>{transaction.destination_account?.name ?? '—'}</dd>
            </div>
          </>
        )}

        {/* Adjustment: show sign context */}
        {type === 'adjustment' && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tipo de ajuste</dt>
            <dd>{transaction.amount > 0 ? 'Suma al saldo' : 'Resta del saldo'}</dd>
          </div>
        )}

        {transaction.description && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descripción</dt>
            <dd>{transaction.description}</dd>
          </div>
        )}

        {/* Credit card specific fields */}
        {transaction.status && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                transaction.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {transaction.status === 'paid' ? 'Pagado' : 'Pendiente'}
              </span>
            </dd>
          </div>
        )}
        {transaction.due_date && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Vencimiento del resumen</dt>
            <dd>{formatDate(transaction.due_date)}</dd>
          </div>
        )}
        {transaction.installment_n && transaction.installments_total && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cuota</dt>
            <dd>{transaction.installment_n} de {transaction.installments_total}</dd>
          </div>
        )}
        {transaction.fx_rate_to_ars && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tipo de cambio</dt>
            <dd>1 USD = ${transaction.fx_rate_to_ars} ARS</dd>
          </div>
        )}
      </dl>

      {/* Installment family */}
      {installmentParent && installmentSiblings && installmentSiblings.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Compra total: {formatBalance(installmentParent.amount, installmentParent.currency_code as 'ARS' | 'USD')} en {installmentSiblings.length} cuotas
          </p>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {installmentSiblings.map((sibling) => (
              <div key={sibling.id} className={`flex justify-between px-3 py-2 text-sm ${sibling.id === transaction.id ? 'bg-muted font-medium' : ''}`}>
                <span>Cuota {sibling.installment_n}</span>
                <span className="flex items-center gap-2">
                  {formatBalance(sibling.amount, sibling.currency_code as 'ARS' | 'USD')}
                  <span className={`text-xs ${sibling.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {sibling.status === 'paid' ? '✓' : '·'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${accountId}/transactions/${transaction.id}/edit`}
          className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Editar
        </Link>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
