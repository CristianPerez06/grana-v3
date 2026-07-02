import { Text, View } from 'react-native'
import { CreditCard } from 'lucide-react-native'
import { formatARS } from '@grana/i18n-messages'
import type { ActiveInstallment } from '../../../lib/cards/queries'
import { formatDayMonth } from '@grana/cards'
import { useT } from '../../../lib/locale-context'
import { stripBold } from './format'
import { CuotaProgressDots } from './CuotaProgressDots'

type Props = {
  items: ActiveInstallment[]
  totalRemaining: number
  accent: string
  showCents?: boolean
}

/**
 * "Cuotas en curso" pane, rendered inline (mobile v1 drops the web movs/cuotas
 * segmented since the per-period movements pane is deferred). An intro card with
 * the total remaining, then a card per installment purchase with progress dots and
 * a footer (per installment / remaining / next due). Empty state when there are none.
 */
export const CuotasEnCursoPane = ({ items, totalRemaining, accent, showCents = false }: Props) => {
  const t = useT()

  // System categories render localized; user-owned keep their literal name.
  const categoryLabelOf = (q: ActiveInstallment): string | null =>
    q.categoryIsSystem && q.categoryCanonicalName
      ? t(`categories.${q.categoryCanonicalName}`)
      : q.categoryName

  if (items.length === 0) {
    return (
      <View className="rounded-[20px] border border-dashed border-border p-8">
        <Text className="text-center text-sm font-semibold text-text">
          {t('cards.detail.cuotas_empty_title')}
        </Text>
        <Text className="mt-1 text-center text-sm text-text-muted">
          {t('cards.detail.cuotas_empty_body')}
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-col gap-4">
      <View className="flex-row items-center justify-between gap-4 rounded-2xl border border-border-soft bg-card p-5">
        <Text className="flex-1 text-sm text-text-muted">
          {stripBold(
            t('cards.detail.cuotas_intro', {
              meta: t('cards.detail.cuotas_meta', { count: items.length }),
            }),
          )}
        </Text>
        <View className="items-end">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('cards.detail.cuotas_total_remaining')}
          </Text>
          <Text className="text-lg font-extrabold text-text">{formatARS(totalRemaining, showCents)}</Text>
        </View>
      </View>

      <View className="flex-col gap-3">
        {items.map((q) => {
          const catLabel = categoryLabelOf(q)
          return (
            <View key={q.parentId} className="flex-col gap-3 rounded-2xl border border-border-soft bg-card p-5">
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: accent }}
                >
                  <CreditCard size={18} color="white" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-bold text-text">
                    {q.description ?? catLabel ?? q.name}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-text-muted">
                    {t('cards.detail.cuotas_purchased', { date: formatDayMonth(q.purchaseDate) })}
                    {catLabel ? ` · ${catLabel}` : ''}
                  </Text>
                </View>
                <Text className="text-sm font-extrabold text-text">
                  {q.paidCount}
                  <Text className="text-text-soft">/{q.total}</Text>
                </Text>
              </View>

              <CuotaProgressDots paid={q.paidCount} total={q.total} accent={accent} />

              <View className="flex-row gap-4 border-t border-border pt-3">
                <FooterStat
                  label={t('cards.detail.cuotas_per_installment')}
                  value={formatARS(q.perInstallment, showCents)}
                />
                <FooterStat
                  label={t('cards.detail.cuotas_remaining')}
                  value={formatARS(q.remaining, showCents)}
                  accentColor={accent}
                />
                <FooterStat
                  label={t('cards.detail.cuotas_next_due')}
                  value={formatDayMonth(q.nextDueDate)}
                />
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const FooterStat = ({
  label,
  value,
  accentColor,
}: {
  label: string
  value: string
  accentColor?: string
}) => (
  <View className="flex-1">
    <Text className="text-[11px] font-semibold uppercase tracking-wider text-text-soft">{label}</Text>
    <Text className="mt-0.5 text-sm font-bold text-text" style={accentColor ? { color: accentColor } : undefined}>
      {value}
    </Text>
  </View>
)
