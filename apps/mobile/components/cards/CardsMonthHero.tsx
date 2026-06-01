import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CardsMonthSummary } from '../../lib/cards/queries'
import { useT } from '../../lib/locale-context'
import { useEyeMask } from '../dashboard/EyeMaskContext'
import { useShowCents } from '../../lib/preferences-context'

type Props = {
  summary: CardsMonthSummary
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MASK = '••••••'

const formatDayMonth = (iso: string): string => {
  const [, mm, dd] = iso.split('-')
  return `${dd}/${mm}`
}

const monthAbbrev = (iso: string): string => {
  const m = Number(iso.split('-')[1])
  return MONTHS_ES[m - 1] ?? ''
}

export const CardsMonthHero = ({ summary }: Props) => {
  const t = useT()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const renderARS = (amount: number) => (masked ? MASK : formatARS(amount, showCents))
  const renderUSD = (amount: number) => (masked ? MASK : formatUSD(amount, showCents))

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <View className="flex-col gap-4 p-5">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('cards.month_hero.eyebrow')}
        </Text>

        {summary.hasToPay ? (
          <View className="flex-col gap-1">
            <Text className="text-4xl font-extrabold tracking-tight text-text">
              {renderARS(summary.toPayARS)}
            </Text>
            {summary.hasUSD && summary.toPayUSD > 0 && (
              <Text className="text-base font-bold text-text-muted">
                {renderUSD(summary.toPayUSD)}
              </Text>
            )}
          </View>
        ) : (
          <Text className="text-sm text-text-muted">{t('cards.month_hero.empty')}</Text>
        )}

        {summary.nextDue?.isToPay && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-amber/10 px-4 py-3">
            <View className="flex-col">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-amber">
                {t('cards.month_hero.next_due_label')}
              </Text>
              <Text className="text-sm font-semibold text-text">
                {t('cards.month_hero.next_due_value', {
                  card: summary.nextDue.cardName,
                  date: formatDayMonth(summary.nextDue.dueDate),
                })}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View className="border-t border-border" />

      <View className="flex-col gap-3 p-5">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('cards.month_hero.upcoming_title')}
        </Text>
        {summary.upcoming.length > 0 ? (
          <View className="flex-col gap-3">
            {summary.upcoming.map((due) => (
              <View key={due.cardId} className="flex-row items-center gap-3">
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-border-soft">
                  <Text className="text-sm font-extrabold tabular-nums text-text">
                    {due.dueDate.split('-')[2]}
                  </Text>
                  <Text className="text-[10px] font-semibold uppercase text-text-soft">
                    {monthAbbrev(due.dueDate)}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-semibold text-text">
                    {due.cardName}
                  </Text>
                  <Text className="text-xs text-text-muted">
                    {due.isToPay
                      ? t('cards.month_hero.upcoming_due', { date: formatDayMonth(due.dueDate) })
                      : t('cards.month_hero.upcoming_open', { date: formatDayMonth(due.endDate) })}
                  </Text>
                </View>
                <Text className="shrink-0 text-sm font-bold tabular-nums text-text">
                  {renderARS(due.amountARS)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-sm text-text-muted">{t('cards.month_hero.upcoming_empty')}</Text>
        )}
      </View>
    </View>
  )
}
