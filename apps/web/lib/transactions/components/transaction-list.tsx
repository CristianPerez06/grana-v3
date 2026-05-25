import type { TransactionWithDetails } from '../types'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

type RowMeta = {
  label: string
  secondaryLabel: string | null
  sign: '+' | '-'
  colorClass: string
  amount: number
}

type Translator = (key: string, params?: Record<string, string | number>) => string

function getRowMeta(
  tx: TransactionWithDetails,
  currentAccountId: string,
  t: Translator,
): RowMeta {
  const absAmount = Math.abs(tx.amount)

  if (tx.type === 'income') {
    return {
      label: tx.category?.name ?? t('types.income'),
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
        label: tx.description ?? t('card_payment_label'),
        secondaryLabel: null,
        sign: '-',
        colorClass: 'text-foreground',
        amount: absAmount,
      }
    }
    return {
      label: tx.category?.name ?? t('types.expense'),
      secondaryLabel: tx.description ?? null,
      sign: '-',
      colorClass: 'text-foreground',
      amount: absAmount,
    }
  }

  if (tx.type === 'transfer') {
    const isOutgoing = tx.account_id === currentAccountId
    const secondaryLabel = isOutgoing
      ? `→ ${tx.destination_account?.name ?? t('labels.destination_account')}`
      : `← ${tx.source_account?.name ?? t('labels.source_account')}`

    return {
      label: t('types.transfer'),
      secondaryLabel: tx.description ?? secondaryLabel,
      sign: isOutgoing ? '-' : '+',
      colorClass: isOutgoing ? 'text-foreground' : 'text-green-600',
      amount: absAmount,
    }
  }

  // adjustment
  const isPositive = tx.amount > 0
  return {
    label: t('types.adjustment'),
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

export const TransactionList = async ({ transactions, accountId }: Props) => {
  const t = (await getTranslations('transactions')) as Translator
  const locale = await getLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(localeCode, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium text-foreground">{t('empty.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('empty.description')}
        </p>
        <Link
          href={`/accounts/${accountId}/transactions/new`}
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          + {t('empty.cta')}
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
              const meta = getRowMeta(tx, accountId, t)
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
                      {new Intl.NumberFormat(localeCode, {
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
