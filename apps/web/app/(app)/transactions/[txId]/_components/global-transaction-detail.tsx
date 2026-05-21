'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import type { FinancialMovement, MovementReviewFlag } from '@/lib/transactions/movements'
import type { TransactionWithDetails } from '@/lib/transactions/types'

const formatBalance = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(Math.abs(amount), showCents) : formatUSD(Math.abs(amount), showCents)

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const reviewLabel: Record<MovementReviewFlag, string> = {
  missing_category: 'Sin categoría',
  missing_fx_rate: 'Revisar cotización',
}

const movementTone = (movement: FinancialMovement) => {
  if (movement.kind === 'income') return 'text-green-600'
  if (movement.kind === 'adjustment' && movement.sign === '+') return 'text-green-600'
  return 'text-foreground'
}

const detailRows = (
  transaction: TransactionWithDetails,
  movement: FinancialMovement,
  installmentSiblings?: TransactionWithDetails[] | null,
): Array<{ label: string; value: string | null }> => {
  const payment = transaction.period_payments?.[0]
  const installmentCardName = installmentSiblings?.find((sibling) => sibling.source_account)
    ?.source_account?.name ?? null

  if (movement.kind === 'transfer') {
    return [
      { label: 'Cuenta origen', value: movement.account_name },
      { label: 'Cuenta destino', value: movement.destination_account_name },
      { label: 'Descripción', value: movement.description },
    ]
  }

  if (movement.kind === 'adjustment') {
    return [
      {
        label: 'Tipo de ajuste',
        value: transaction.amount > 0 ? 'Suma al saldo' : 'Resta del saldo',
      },
      { label: 'Cuenta', value: movement.account_name },
      { label: 'Descripción', value: movement.description },
    ]
  }

  if (movement.kind === 'card_payment') {
    return [
      { label: 'Cuenta de pago', value: movement.account_name },
      { label: 'Tarjeta', value: payment?.period?.account?.name ?? null },
      { label: 'Resumen', value: payment?.period ? `${formatDate(payment.period.start_date)} - ${formatDate(payment.period.end_date)}` : null },
      { label: 'Vencimiento', value: payment?.period?.due_date ? formatDate(payment.period.due_date) : null },
      { label: 'Descripción', value: movement.description },
    ]
  }

  if (movement.kind === 'installment_purchase') {
    return [
      { label: 'Tarjeta', value: installmentCardName },
      {
        label: 'Cuotas',
        value: movement.installments_total ? `${movement.installments_total} cuotas` : null,
      },
      { label: 'Categoría', value: transaction.category?.name ?? null },
      { label: 'Subcategoría', value: transaction.subcategory?.name ?? null },
      { label: 'Descripción', value: movement.description },
    ]
  }

  return [
    { label: 'Cuenta', value: movement.account_name },
    { label: 'Categoría', value: transaction.category?.name ?? null },
    { label: 'Subcategoría', value: transaction.subcategory?.name ?? null },
    { label: 'Descripción', value: movement.description },
  ]
}

type Props = {
  transaction: TransactionWithDetails
  movement: FinancialMovement
  installmentParent?: TransactionWithDetails | null
  installmentSiblings?: TransactionWithDetails[] | null
}

export const GlobalTransactionDetail = ({
  transaction,
  movement,
  installmentParent,
  installmentSiblings,
}: Props) => {
  const showCents = useShowCents()
  const sign = movement.sign ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {movement.title}
        </span>
        <p className={`text-3xl font-bold tabular-nums ${movementTone(movement)}`}>
          {sign}{formatBalance(movement.amount, movement.currency_code, showCents)}
        </p>
        <p className="text-sm text-muted-foreground">{movement.currency_code}</p>
      </div>

      {movement.review_flags.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <div>
            <p className="font-medium">Movimiento a revisar</p>
            <p>{movement.review_flags.map((flag) => reviewLabel[flag]).join(' · ')}</p>
          </div>
        </div>
      )}

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="text-right capitalize">{formatDate(movement.date)}</dd>
        </div>

        {detailRows(transaction, movement, installmentSiblings)
          .filter((row) => row.value)
          .map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right">{row.value}</dd>
            </div>
          ))}

        {transaction.status && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                transaction.status === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {transaction.status === 'paid' ? 'Pagado' : 'Pendiente'}
              </span>
            </dd>
          </div>
        )}

        {transaction.fx_rate_to_ars && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tipo de cambio</dt>
            <dd>1 USD = ${transaction.fx_rate_to_ars} ARS</dd>
          </div>
        )}
      </dl>

      {installmentParent && installmentSiblings && installmentSiblings.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Compra total: {formatBalance(installmentParent.amount, installmentParent.currency_code, showCents)} en {installmentSiblings.length} cuotas
          </p>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {installmentSiblings.map((sibling) => (
              <div
                key={sibling.id}
                className="flex justify-between px-3 py-2 text-sm"
              >
                <span>Cuota {sibling.installment_n}</span>
                <span className="flex items-center gap-2">
                  {formatBalance(sibling.amount, sibling.currency_code, showCents)}
                  <span className={`text-xs ${sibling.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {sibling.status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transaction.account_id && (
        <Link
          href={`/accounts/${transaction.account_id}/transactions/${transaction.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver en cuenta
        </Link>
      )}
    </div>
  )
}
