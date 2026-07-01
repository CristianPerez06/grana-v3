'use client'

import { useTranslations } from 'next-intl'
import { MovementList } from '@/lib/transactions/components/movement-list'
import type { LifecyclePeriod, PeriodKey } from '@grana/cards'
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

  const list = (
    <MovementList
      movements={movements}
      perspective={{ kind: 'account', accountId: cardId }}
      todayISO={todayISO}
      installmentChips={chips}
      installmentChipBelow
      // Group by date (Hoy / Ayer / día) like the Movimientos module, so each
      // consumo shows its date. The statement's txs come date-desc, so headers
      // land in order.
      groupByDate
      emptyState={{
        variant: 'none',
        title: t('detail.movements_empty_title'),
        body: t('detail.movements_empty_body'),
      }}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('detail.movements_heading', { period: periodLabel })}</h2>
        <span className="text-xs text-text-muted">
          {t('detail.movements_count', { count: movements.length })}
        </span>
      </div>

      {movements.length === 0 ? (
        list
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">{list}</div>
      )}
    </div>
  )
}
