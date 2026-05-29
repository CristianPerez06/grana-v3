'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import type { TransactionWithDetails } from '@/lib/transactions/types'

// Renders the list of installment rows inside a TxDetailGroup. Each row gets
// a circular number badge whose color reflects the installment status:
// - `pending` → warning-soft / warning-deep (próxima a vencer del período).
// - `paid`    → income/14 / income.
// - other     → muted / muted-foreground (futura lejana, ya cancelada, etc.).
//
// `current` flags the row the user is currently viewing so we don't wrap it
// in a Link to itself.

const stateClass = (status: 'pending' | 'paid' | null): string => {
  if (status === 'pending') return 'bg-warning-soft text-warning-deep'
  if (status === 'paid') return 'bg-emerald-soft text-emerald-deep'
  return 'bg-muted text-text-muted'
}

const formatAmount = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

type Props = {
  installments: TransactionWithDetails[]
  currentId: string
  /** Forwarded so navigating into a sibling preserves the origin. */
  from?: string
}

export const TxInstallmentRows = ({ installments, currentId, from }: Props) => {
  const t = useTranslations('transactions')
  const showCents = useShowCents()

  return (
    <>
      {installments.map((c, i) => {
        const isCurrent = c.id === currentId
        const total = c.installments_total ?? installments.length
        const n = c.installment_n ?? i + 1
        const periodLabel = c.due_date
          ? new Date(c.due_date).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
            })
          : null

        const row = (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft last:border-b-0">
            <div
              className={`size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${stateClass(c.status)}`}
            >
              {n}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-text">
                {t('installments.position', { n, total })}
              </div>
              {periodLabel && (
                <div className="text-[12px] text-text-soft">
                  {t('installments.due', { date: periodLabel })}
                </div>
              )}
            </div>
            {c.status && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateClass(c.status)}`}
              >
                {t(`installments.status.${c.status}`)}
              </span>
            )}
            <div className="text-[13.5px] font-semibold text-text tabular-nums tracking-[-0.1px]">
              {formatAmount(c.amount, c.currency_code, showCents)}
            </div>
          </div>
        )

        if (isCurrent) {
          return <div key={c.id}>{row}</div>
        }

        const href = from
          ? `/transactions/${c.id}?from=${from}`
          : `/transactions/${c.id}`
        return (
          <Link key={c.id} href={href} className="block hover:bg-muted/30 transition-colors">
            {row}
          </Link>
        )
      })}
    </>
  )
}
