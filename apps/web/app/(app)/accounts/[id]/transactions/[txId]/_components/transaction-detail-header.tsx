'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { deleteTransaction } from '@/app/_actions/transactions'

const formatBalance = (amount: number, currency: 'ARS' | 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type Props = {
  transaction: TransactionWithDetails
  accountId: string
}

export const TransactionDetailHeader = ({ transaction, accountId }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      setError(null)
      const result = await deleteTransaction(transaction.id, accountId)
      if (!result.ok) {
        setError(result.formError ?? 'Error al eliminar.')
        return
      }
      router.push(`/accounts/${accountId}`)
    })
  }

  const isIncome = transaction.type === 'income'

  return (
    <div className="flex flex-col gap-6">
      {/* Type badge + amount */}
      <div className="flex flex-col gap-1">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            isIncome
              ? 'bg-green-100 text-green-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {isIncome ? 'Ingreso' : 'Gasto'}
        </span>
        <p className={`text-3xl font-bold tabular-nums ${isIncome ? 'text-green-600' : ''}`}>
          {isIncome ? '+' : '-'}{formatBalance(transaction.amount, transaction.currency_code)}
        </p>
        <p className="text-sm text-muted-foreground">{transaction.currency_code}</p>
      </div>

      {/* Details */}
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="capitalize">{formatDate(transaction.date)}</dd>
        </div>
        {transaction.category && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Categoría</dt>
            <dd>{transaction.category.name}</dd>
          </div>
        )}
        {transaction.subcategory && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subcategoría</dt>
            <dd>{transaction.subcategory.name}</dd>
          </div>
        )}
        {transaction.description && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descripción</dt>
            <dd>{transaction.description}</dd>
          </div>
        )}
      </dl>

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
