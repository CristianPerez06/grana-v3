import { Text, View } from 'react-native'
import type { SharedExpenseItem } from '../../lib/shared/queries'
import { useT } from '../../lib/locale-context'
import { fmtMoney } from './money'
import { CARD, CAT_FALLBACK } from './ui'

type Props = {
  items: SharedExpenseItem[]
  /** Current user id — to render "Pagaste" vs "Pagó {name}". */
  youId: string
  limit?: number
}

// Recent shared movements as an operational log (mirror of the design mock's
// `.mv` rows): a colored category tile, title + taxonomy/own-share subtitle, and
// the movement TOTAL as the protagonist amount (signed by kind). The own share
// lives in the subtitle as "Tu parte" — never a "parte de {name}" perspective label.
export function RecentSharedList({ items, youId, limit = 8 }: Props) {
  const t = useT()
  const rows = items.slice(0, limit)

  return (
    <View className={CARD}>
      <View className="border-b border-border-soft px-4 py-3.5">
        <Text className="text-sm font-extrabold text-text">
          {t('shared.dashboard.recent_title')}
        </Text>
      </View>

      {rows.length === 0 ? (
        <Text className="px-4 py-5 text-sm text-text-muted">{t('shared.dashboard.empty')}</Text>
      ) : (
        rows.map((i, idx) => {
          const title = i.description ?? i.categoryName ?? t('shared.split.shared_label')
          const received = i.kind === 'reimbursement' && i.reimbursementState === 'received'
          const isReimb = i.kind === 'reimbursement'
          const sign = isReimb ? (received ? '+' : '') : '−'
          const amountClass = isReimb ? (received ? 'text-positive' : 'text-warning') : 'text-negative'
          const color = i.categoryColor ?? CAT_FALLBACK[idx % CAT_FALLBACK.length]
          const showOwn = Math.abs(i.ownShare - i.amount) > 0.005

          const taxonomy = [i.categoryName, i.subcategoryName].filter(Boolean).join(' › ')
          const paidBy =
            i.payerId === youId
              ? t('shared.dashboard.paid_by_you')
              : t('shared.dashboard.paid_by', { name: i.payerName })
          const subtitle = [
            taxonomy || null,
            paidBy,
            showOwn ? t('shared.dashboard.your_share', { amount: fmtMoney(i.ownShare, i.currencyCode) }) : null,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <View
              key={i.id}
              className={`flex-row items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-border-soft' : ''}`}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}1A` }}
              >
                <Text className="text-base">{i.categoryIcon ?? '🧾'}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-[13px] font-extrabold text-text" numberOfLines={1}>
                  {title}
                </Text>
                <Text className="mt-0.5 text-[11.5px] text-text-muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              <Text className={`text-[13.5px] font-extrabold ${amountClass}`}>
                {sign}
                {fmtMoney(i.amount, i.currencyCode)}
              </Text>
            </View>
          )
        })
      )}
    </View>
  )
}
