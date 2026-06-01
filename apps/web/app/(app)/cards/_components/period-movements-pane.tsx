'use client'

import { useTranslations } from 'next-intl'
import { MovementList } from '@/lib/transactions/components/movement-list'
import type { LifecyclePeriod, PeriodKey } from './card-detail-types'
import { cardPeriodTransactionToMovement, installmentChip } from './card-movement-mapper'

type Props = {
  cardId: string
  period: LifecyclePeriod
  periodKey: PeriodKey
  todayISO: string
}

/**
 * "Movimientos del período" pane. Maps the statement's transactions to
 * FinancialMovements and renders them through the shared MovementList, with the
 * "Cuota X de Y" chip injected per row. Empty → "Sin movimientos".
 */
export const PeriodMovementsPane = ({ cardId, period, periodKey, todayISO }: Props) => {
  const t = useTranslations('cards')

  const periodLabel = t(`detail.period_label_${periodKey}`)
  const movements = period.transactions.map(cardPeriodTransactionToMovement)
  const chips = new Map<string, string>()
  for (const tx of period.transactions) {
    const chip = installmentChip(tx, (n, total) => t('detail.installment_chip', { n, total }))
    if (chip) chips.set(tx.id, chip)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('detail.movements_heading', { period: periodLabel })}</h2>
        <span className="text-xs text-text-muted">
          {t('detail.movements_count', { count: movements.length })}
        </span>
      </div>

      <MovementList
        movements={movements}
        perspective={{ kind: 'account', accountId: cardId }}
        todayISO={todayISO}
        installmentChips={chips}
        emptyState={{
          variant: 'none',
          title: t('detail.movements_empty_title'),
          body: t('detail.movements_empty_body'),
        }}
      />
    </div>
  )
}
