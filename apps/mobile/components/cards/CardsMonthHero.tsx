import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CardsMonthSummary } from '@grana/cards'
import { useT } from '../../lib/locale-context'
import { useEyeMask } from '../dashboard/EyeMaskContext'
import { useShowCents } from '../../lib/preferences-context'

type Props = {
  summary: CardsMonthSummary
}

const MASK = '••••••'

const formatDayMonth = (iso: string): string => {
  const [, mm, dd] = iso.split('-')
  return `${dd}/${mm}`
}

/**
 * "A pagar este mes" hero — the dark navy card of the cards module (same surface
 * as the dashboard hero). ARS primary, USD subordinate and SEPARATE (Bimoneda).
 * Below, "Próximos cierres": the next close DATES (not payment due dates), each
 * grouped with all the cards that close that day.
 */
export const CardsMonthHero = ({ summary }: Props) => {
  const t = useT()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const renderARS = (amount: number) => (masked ? MASK : formatARS(amount, showCents))
  const renderUSD = (amount: number) => (masked ? MASK : formatUSD(amount, showCents))

  return (
    <View className="rounded-2xl bg-navy p-6">
      <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/55">
        {t('cards.month_hero.eyebrow')}
      </Text>

      {summary.hasToPay ? (
        <View className="mt-2 flex-col gap-1">
          <Text className="text-[38px] font-extrabold tracking-tight text-white">
            {renderARS(summary.toPayARS)}
          </Text>
          {summary.hasUSD && summary.toPayUSD !== 0 && (
            <View className="mt-1 flex-row items-center gap-2">
              <View className="rounded-full bg-emerald-soft px-2.5 py-0.5">
                <Text className="text-[11px] font-extrabold text-positive">USD</Text>
              </View>
              <Text className="text-[15px] font-bold text-white/90">
                {renderUSD(summary.toPayUSD)}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text className="mt-2 text-sm text-white/70">{t('cards.month_hero.empty')}</Text>
      )}

      {/* En curso — resúmenes abiertos, sigue sumando hasta el cierre (paridad con web) */}
      <View className="mt-5 border-t border-white/10 pt-4">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/55">
          {t('cards.month_hero.in_progress_label')}
        </Text>
        <Text className="mt-1 text-2xl font-bold tracking-tight text-white/90">
          {renderARS(summary.inProgressARS)}
        </Text>
        {summary.hasUSD && summary.inProgressUSD !== 0 && (
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full bg-emerald-soft px-2 py-0.5">
              <Text className="text-[10px] font-extrabold text-positive">USD</Text>
            </View>
            <Text className="text-[15px] font-bold text-white/80">
              {renderUSD(summary.inProgressUSD)}
            </Text>
          </View>
        )}
        <Text className="mt-1.5 text-[12px] text-white/45">
          {t('cards.month_hero.in_progress_caption')}
        </Text>
      </View>

      <View className="mt-5 border-t border-white/10 pt-4">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/55">
          {t('cards.month_hero.next_closes_label')}
        </Text>
        {summary.nextCloses.length > 0 ? (
          <View className="mt-3 flex-col gap-2.5">
            {summary.nextCloses.map((close, i) => (
              <View key={`${close.endDate}-${i}`} className="flex-row items-center gap-3">
                <Text className="w-12 text-sm font-extrabold tabular-nums text-white">
                  {formatDayMonth(close.endDate)}
                </Text>
                <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-white/80">
                  {close.cardName}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="mt-2 text-sm text-white/50">{t('cards.month_hero.next_closes_empty')}</Text>
        )}
      </View>
    </View>
  )
}
