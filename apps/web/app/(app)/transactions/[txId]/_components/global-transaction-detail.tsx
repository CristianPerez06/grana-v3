'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { TransactionActions } from '@/lib/transactions/components/transaction-actions'
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

const movementTone = (movement: FinancialMovement) => {
  if (movement.kind === 'income') return 'text-green-600'
  if (movement.kind === 'adjustment' && movement.sign === '+') return 'text-green-600'
  return 'text-foreground'
}

const detailRows = (
  transaction: TransactionWithDetails,
  movement: FinancialMovement,
  t: (key: string) => string,
  installmentSiblings?: TransactionWithDetails[] | null,
): Array<{ label: string; value: string | null }> => {
  const payment = transaction.period_payments?.[0]
  const installmentCardName = installmentSiblings?.find((sibling) => sibling.source_account)
    ?.source_account?.name ?? null

  if (movement.kind === 'transfer') {
    return [
      { label: t('labels.source_account'), value: movement.account_name },
      { label: t('labels.destination_account'), value: movement.destination_account_name },
      { label: t('labels.description'), value: movement.description },
    ]
  }

  if (movement.kind === 'adjustment') {
    return [
      {
        label: t('labels.adjustment_type'),
        value: transaction.amount > 0 ? t('directions.increase_full') : t('directions.decrease_full'),
      },
      { label: t('labels.account'), value: movement.account_name },
      { label: t('labels.description'), value: movement.description },
    ]
  }

  if (movement.kind === 'card_payment') {
    return [
      { label: t('labels.payment_account'), value: movement.account_name },
      { label: t('labels.card'), value: payment?.period?.account?.name ?? null },
      { label: t('labels.billing_period'), value: payment?.period ? `${formatDate(payment.period.start_date)} - ${formatDate(payment.period.end_date)}` : null },
      { label: t('labels.due_date'), value: payment?.period?.due_date ? formatDate(payment.period.due_date) : null },
      { label: t('labels.description'), value: movement.description },
    ]
  }

  if (movement.kind === 'installment_purchase') {
    return [
      { label: t('labels.card'), value: installmentCardName },
      {
        label: t('labels.installments'),
        value: movement.installments_total
          ? `${movement.installments_total} ${t('labels.installments').toLowerCase()}`
          : null,
      },
      { label: t('labels.category'), value: transaction.category?.name ?? null },
      { label: t('labels.subcategory'), value: transaction.subcategory?.name ?? null },
      { label: t('labels.description'), value: movement.description },
    ]
  }

  if (movement.kind === 'exchange') {
    return [
      { label: t('labels.source_account'), value: movement.account_name },
      { label: t('labels.destination_account'), value: movement.destination_account_name },
      { label: t('labels.description'), value: movement.description },
    ]
  }

  return [
    { label: t('labels.account'), value: movement.account_name },
    { label: t('labels.category'), value: transaction.category?.name ?? null },
    { label: t('labels.subcategory'), value: transaction.subcategory?.name ?? null },
    { label: t('labels.description'), value: movement.description },
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
  const t = useTranslations('transactions')
  const sign = movement.sign ?? ''

  const reviewLabel: Record<MovementReviewFlag, string> = {
    missing_category: t('review_flags.missing_category'),
    missing_fx_rate: t('review_flags.missing_fx_rate'),
  }

  // Account used to edit/delete. For a normal movement it's its own account;
  // for an installment parent (account_id=NULL) it's a child's card account.
  const actionAccountId = transaction.account_id ?? installmentSiblings?.[0]?.account_id ?? null
  const editHref = actionAccountId
    ? `/accounts/${actionAccountId}/transactions/${transaction.id}/edit?from=transactions`
    : null

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
            <p className="font-medium">{t('review_alert_title')}</p>
            <p>{movement.review_flags.map((flag) => reviewLabel[flag]).join(' · ')}</p>
          </div>
        </div>
      )}

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t('labels.date')}</dt>
          <dd className="text-right capitalize">{formatDate(movement.date)}</dd>
        </div>

        {detailRows(transaction, movement, t, installmentSiblings)
          .filter((row) => row.value)
          .map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right">{row.value}</dd>
            </div>
          ))}

        {movement.kind === 'exchange' && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('labels.exchange_received')}</dt>
              <dd className="text-right text-green-600">
                +{formatBalance(movement.destination_amount, movement.destination_currency, showCents)}
              </dd>
            </div>
            {movement.destination_amount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('labels.fx_rate')}</dt>
                {/* Derived display rate (cosmetic, not persisted). */}
                <dd className="text-right">
                  1 {movement.destination_currency} ={' '}
                  {formatBalance(movement.amount / movement.destination_amount, movement.currency_code, showCents)}
                </dd>
              </div>
            )}
          </>
        )}

        {transaction.status && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('labels.status')}</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                transaction.status === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {transaction.status === 'paid' ? t('statuses.paid') : t('statuses.pending')}
              </span>
            </dd>
          </div>
        )}

        {transaction.fx_rate_to_ars && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('labels.fx_rate')}</dt>
            <dd>{t('fx_rate_template', { rate: transaction.fx_rate_to_ars })}</dd>
          </div>
        )}
      </dl>

      {installmentParent && installmentSiblings && installmentSiblings.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {t('installment_summary', {
              amount: formatBalance(installmentParent.amount, installmentParent.currency_code, showCents),
              count: installmentSiblings.length,
            })}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {installmentSiblings.map((sibling) => (
              <div
                key={sibling.id}
                className="flex justify-between px-3 py-2 text-sm"
              >
                <span>{t('installment_label', { number: sibling.installment_n ?? 0 })}</span>
                <span className="flex items-center gap-2">
                  {formatBalance(sibling.amount, sibling.currency_code, showCents)}
                  <span className={`text-xs ${sibling.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {sibling.status === 'paid' ? t('statuses.installment_paid') : t('statuses.pending')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {actionAccountId && editHref && (
        <TransactionActions
          transaction={transaction}
          accountId={actionAccountId}
          returnHref="/transactions"
          editHref={editHref}
        />
      )}

      {transaction.account_id && (
        <Link
          href={`/accounts/${transaction.account_id}/transactions/${transaction.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('actions.view_in_account')}
        </Link>
      )}
    </div>
  )
}
