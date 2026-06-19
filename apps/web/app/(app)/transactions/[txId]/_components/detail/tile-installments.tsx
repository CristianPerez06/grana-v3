'use client'

import { Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useShowCents } from '@/lib/preferences-context'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { Tile, TileHead } from './glance'
import { fmtMoney, formatShortDate } from './helpers'

// Tile "En cuotas": barra de cuotas pagadas/restantes, valor por cuota,
// próxima fecha y fecha de fin. Deriva todo de las cuotas hermanas (children).

type Props = {
  children_: TransactionWithDetails[]
  parentAmount: number
  currency: 'ARS' | 'USD'
  /** installment_n of the row being viewed (null on the parent). */
  currentN: number | null
}

export const TileInstallments = ({ children_, parentAmount, currency, currentN }: Props) => {
  const t = useTranslations('transactions.detail')
  const showCents = useShowCents()
  if (!children_.length) return null

  const total = children_.length
  const sorted = [...children_].sort((a, b) => (a.installment_n ?? 0) - (b.installment_n ?? 0))
  const paidCount = sorted.filter((c) => c.status === 'paid').length
  const perInstallment = sorted[0]?.amount ?? parentAmount / total
  const paidAmount = perInstallment * paidCount
  const remainingAmount = Math.max(0, parentAmount - paidAmount)
  const nextChild = sorted.find((c) => c.status !== 'paid')
  const lastChild = sorted[sorted.length - 1]
  const activeN = currentN ?? (paidCount > 0 ? paidCount : 1)

  return (
    <Tile>
      <TileHead
        eyebrow={t('installments.eyebrow')}
        aside={t('installments.per_month', { amount: fmtMoney(perInstallment, currency, showCents) })}
      />
      <div className="text-[24px] font-extrabold tracking-[-0.03em] tabular-nums text-text sm:text-[27px]">
        {t('installments.current', { n: activeN })}{' '}
        <span className="text-[15px] font-bold text-text-muted">{t('installments.of', { total })}</span>
      </div>

      <div className="my-3.5 flex gap-1.5">
        {sorted.map((c) => {
          const isPaid = c.status === 'paid'
          const isCurrent = c.installment_n === activeN
          return (
            <span
              key={c.id}
              className="h-[9px] flex-1 rounded-full"
              style={{
                background: isPaid ? 'var(--tone)' : isCurrent ? 'var(--tone)' : 'var(--border-soft)',
                opacity: !isPaid && isCurrent ? 0.4 : 1,
              }}
            />
          )
        })}
      </div>

      <div className="flex justify-between text-[13px] font-semibold text-text-muted">
        <span>
          <b className="font-bold text-text tabular-nums">{fmtMoney(paidAmount, currency, showCents)}</b>{' '}
          {t('installments.paid')}
        </span>
        <span className="tabular-nums">
          {t('installments.remaining', { amount: fmtMoney(remainingAmount, currency, showCents) })}
        </span>
      </div>

      {(nextChild || lastChild) && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3.5 text-[13.5px] font-semibold text-text-muted">
          <Clock size={15} strokeWidth={2} className="shrink-0 text-slate" aria-hidden />
          {nextChild ? (
            <span>
              {t('installments.next')}: <b className="font-bold text-text">{formatShortDate(nextChild.date)}</b>
              {lastChild && (
                <>
                  {' · '}
                  {t('installments.ends')} <b className="font-bold text-text">{formatShortDate(lastChild.date)}</b>
                </>
              )}
            </span>
          ) : (
            <span>{t('installments.completed')}</span>
          )}
        </div>
      )}
    </Tile>
  )
}
