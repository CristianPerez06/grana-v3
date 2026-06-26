import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { PendingReimbursementVM } from '@grana/transactions'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'

type Props = {
  items: PendingReimbursementVM[]
}

// "Reintegros a confirmar" — expected reimbursements scoped to this account, shown
// read-only (confirming/cancelling lives in the transactions module). Renders
// nothing when there are none.
export function PendingReimbursementsCard({ items }: Props) {
  const t = useT()
  const showCents = useShowCents()

  if (items.length === 0) return null

  return (
    <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
      <Text className="text-[15px] font-bold text-text">
        {t('transactions.reimbursement.pending.title')}
      </Text>
      <View className="gap-3">
        {items.map((item) => {
          const categoryLabel = item.categoryIsSystem
            ? item.categoryCanonicalName
              ? t(`categories.${item.categoryCanonicalName}`)
              : null
            : item.categoryName
          const title = item.expenseDescription?.trim() || categoryLabel || t('transactions.reimbursement.label')
          const formatted =
            item.currencyCode === 'ARS'
              ? formatARS(item.estimatedAmount, showCents)
              : formatUSD(item.estimatedAmount, showCents)
          return (
            <View key={item.id} className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-[14px] font-bold text-text" numberOfLines={1}>
                  {title}
                </Text>
                {categoryLabel && categoryLabel !== title && (
                  <Text className="mt-0.5 text-[12px] text-text-muted" numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                )}
              </View>
              <Text className="text-[14px] font-extrabold tabular-nums text-emerald-deep">
                + {formatted}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
