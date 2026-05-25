'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { deleteTransaction, deleteTransfer, deleteAdjustment } from '@/app/_actions/transactions'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'

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

type Props = {
  transaction: TransactionWithDetails
  accountId: string
  periodId?: string | null
  returnHref?: string
  showActions?: boolean
  installmentParent?: TransactionWithDetails | null
  installmentSiblings?: TransactionWithDetails[] | null
}

export const TransactionDetailHeader = ({ transaction, accountId, periodId, returnHref, showActions = true, installmentParent, installmentSiblings }: Props) => {
  const t = useTranslations('transactions')
  const showCents = useShowCents()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { type } = transaction

  const TYPE_LABELS: Record<typeof type, string> = {
    income: t('types.income'),
    expense: t('types.expense'),
    transfer: t('types.transfer'),
    adjustment: t('types.adjustment'),
  }

  const confirmMessage =
    type === 'transfer'
      ? t('confirmations.delete_transfer_inline')
      : type === 'adjustment'
        ? t('confirmations.delete_adjustment_inline')
        : t('confirmations.delete_movement_inline')

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
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      router.push(returnHref ?? (periodId ? `/cards/${accountId}/periods/${periodId}` : `/accounts/${accountId}`))
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
          {transaction.is_parent
            ? t('installment_purchase_label')
            : (transaction.period_payments?.length ?? 0) > 0
              ? t('card_payment_label')
              : TYPE_LABELS[type]}
        </span>
        <p className={`text-3xl font-bold tabular-nums ${isPositive ? 'text-green-600' : ''}`}>
          {sign}{formatBalance(displayAmount, transaction.currency_code, showCents)}
        </p>
        <p className="text-sm text-muted-foreground">{transaction.currency_code}</p>
      </div>

      {/* Details */}
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t('labels.date')}</dt>
          <dd className="capitalize">{formatDate(transaction.date)}</dd>
        </div>

        {/* Income/Expense: category */}
        {(type === 'income' || type === 'expense') && transaction.category && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.category')}</dt>
            <dd>{transaction.category.name}</dd>
          </div>
        )}
        {(type === 'income' || type === 'expense') && transaction.subcategory && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.subcategory')}</dt>
            <dd>{transaction.subcategory.name}</dd>
          </div>
        )}

        {/* Transfer: source and destination accounts */}
        {type === 'transfer' && (
          <>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('labels.source_account')}</dt>
              <dd>{transaction.source_account?.name ?? accountId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('labels.destination_account')}</dt>
              <dd>{transaction.destination_account?.name ?? '—'}</dd>
            </div>
          </>
        )}

        {/* Adjustment: show sign context */}
        {type === 'adjustment' && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.adjustment_type')}</dt>
            <dd>{transaction.amount > 0 ? t('directions.increase_full') : t('directions.decrease_full')}</dd>
          </div>
        )}

        {transaction.description && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.description')}</dt>
            <dd>{transaction.description}</dd>
          </div>
        )}

        {/* Credit card specific fields */}
        {transaction.status && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.status')}</dt>
            <dd>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                transaction.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {transaction.status === 'paid' ? t('statuses.paid') : t('statuses.pending')}
              </span>
            </dd>
          </div>
        )}
        {transaction.due_date && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.due_date')}</dt>
            <dd>{formatDate(transaction.due_date)}</dd>
          </div>
        )}
        {transaction.installment_n && transaction.installments_total && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('installment_label_short')}</dt>
            <dd>{t('installment_pair', { n: transaction.installment_n, total: transaction.installments_total })}</dd>
          </div>
        )}
        {transaction.fx_rate_to_ars && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('labels.fx_rate')}</dt>
            <dd>{t('fx_rate_template', { rate: transaction.fx_rate_to_ars })}</dd>
          </div>
        )}
      </dl>

      {/* Installment family */}
      {installmentParent && installmentSiblings && installmentSiblings.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {t('installment_summary', {
              amount: formatBalance(installmentParent.amount, installmentParent.currency_code as 'ARS' | 'USD', showCents),
              count: installmentSiblings.length,
            })}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {installmentSiblings.map((sibling) => (
              <div key={sibling.id} className={`flex justify-between px-3 py-2 text-sm ${sibling.id === transaction.id ? 'bg-muted font-medium' : ''}`}>
                <span>{t('installment_label', { number: sibling.installment_n ?? 0 })}</span>
                <span className="flex items-center gap-2">
                  {formatBalance(sibling.amount, sibling.currency_code as 'ARS' | 'USD', showCents)}
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
      {showActions && (
        <div className="flex items-center gap-3">
          <Link
            href={`/accounts/${accountId}/transactions/${transaction.id}/edit`}
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t('actions.edit')}
          </Link>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {t('actions.delete')}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
