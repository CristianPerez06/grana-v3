import { Text, View } from 'react-native'
import type { FinancialMovement } from '@grana/transactions'
import type { LifecyclePeriod, PeriodKey } from '@grana/cards'
import { cardPeriodTransactionToMovement, installmentChip } from '@grana/cards'
import { useT } from '../../../lib/locale-context'
import { MovementList } from '../../movements/MovementList'

type Props = {
  cardId: string
  period: LifecyclePeriod
  periodKey: PeriodKey
  todayISO: string
  /** Present ⇒ rows navigate to the movement detail on tap. */
  onPressMovement?: (movement: FinancialMovement) => void
}

/**
 * "Movimientos del período" pane (native mirror of the web `PeriodMovementsPane`).
 * Maps the statement's transactions to `FinancialMovement`s with the shared
 * `cardPeriodTransactionToMovement` and renders them through the native
 * `MovementList`, with the "Cuota X de Y" chip injected per row. Empty →
 * "Sin movimientos". No reads: `period.transactions` already ships in
 * `CardPeriodDetail`.
 */
export function PeriodMovementsPane({
  cardId,
  period,
  periodKey,
  todayISO,
  onPressMovement,
}: Props) {
  const t = useT()

  const periodLabel = t(`cards.detail.period_label_${periodKey}`)
  const movements = period.transactions.map(cardPeriodTransactionToMovement)
  const chips = new Map<string, string>()
  for (const tx of period.transactions) {
    const chip = installmentChip(tx, (n, total) => t('cards.detail.installment_chip', { n, total }))
    if (chip) chips.set(tx.id, chip)
  }

  const list = (
    <MovementList
      movements={movements}
      perspective={{ kind: 'account', accountId: cardId }}
      todayISO={todayISO}
      installmentChips={chips}
      groupByDate
      onPressMovement={onPressMovement}
      emptyState={{
        title: t('cards.detail.movements_empty_title'),
        body: t('cards.detail.movements_empty_body'),
      }}
    />
  )

  return (
    <View className="flex-col gap-4">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-lg font-bold text-text">
          {t('cards.detail.movements_heading', { period: periodLabel })}
        </Text>
        <Text className="text-xs text-text-muted">
          {t('cards.detail.movements_count', { count: movements.length })}
        </Text>
      </View>

      {movements.length === 0 ? (
        list
      ) : (
        <View className="overflow-hidden rounded-2xl border border-border bg-card">{list}</View>
      )}
    </View>
  )
}
