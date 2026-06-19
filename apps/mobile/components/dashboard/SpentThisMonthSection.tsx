import { Text, View } from 'react-native'
import { formatARS } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { useMonthBalanceSeries, useMonthCategoryBreakdown } from '../../lib/dashboard/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { useEyeMask } from './EyeMaskContext'
import { MaskedAmount } from './MaskedAmount'

// Token mirror for inline segment backgrounds.
const SLATE = '#3A6B8A'
const TERRACOTTA = '#B56A5A'

// Splits the single-tag caption ("<b>{financed}</b> …") so native can bold the
// amount where the web `t.rich` <b> tag would render it.
const Caption = ({ phrase }: { phrase: string }) => {
  const m = phrase.match(/^([\s\S]*)<b>([\s\S]*?)<\/b>([\s\S]*)$/)
  if (!m) return <Text className="text-[12.5px] leading-snug text-text-muted">{phrase}</Text>
  const [, before, inner, after] = m
  return (
    <Text className="text-[12.5px] leading-snug text-text-muted">
      {before}
      <Text className="font-extrabold text-text">{inner}</Text>
      {after}
    </Text>
  )
}

// "Gastaste este mes" (mobile parity) — CAJA → CONSUMO bridge: of what you spent
// this month (devengado), how much left your cash vs. how much was financed on
// the card (`financiado = total devengado − gasto de caja`). Reuses the SAME
// queries as "Balance del mes" and "¿En qué gasté?" (TanStack dedupes — no extra
// fetch). On mobile the bar stacks to a column. Renders nothing without card spend.
export const SpentThisMonthSection = () => {
  const t = useT()
  const { selected } = useDashboardMonth()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const balanceQuery = useMonthBalanceSeries(selected.year, selected.month)
  const breakdownQuery = useMonthCategoryBreakdown(selected.year, selected.month)

  const cash = balanceQuery.data?.ARS.totalExpense ?? 0
  const accrued = (breakdownQuery.data?.ARS ?? []).reduce((sum, slice) => sum + slice.value, 0)
  const financed = Math.round((accrued - cash) * 100) / 100
  if (financed <= 0) return null

  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, showCents))

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-lg font-semibold text-text">{t('dashboard.spent.title')}</Text>
        <MaskedAmount
          amount={accrued}
          currency="ARS"
          className="text-[18px] font-extrabold text-text"
        />
      </View>

      {/* Stacked bands (the web bar collapses to a column on mobile). */}
      <View className="gap-2">
        <View
          className="min-h-[3.5rem] justify-center gap-0.5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: SLATE }}
        >
          <Text className="text-[10.5px] font-extrabold uppercase text-white/80">
            {t('dashboard.spent.from_cash')}
          </Text>
          <MaskedAmount
            amount={cash}
            currency="ARS"
            className="text-[15px] font-extrabold text-white"
          />
        </View>
        <View
          className="min-h-[3.5rem] justify-center gap-0.5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: TERRACOTTA }}
        >
          <Text className="text-[10.5px] font-extrabold uppercase text-white/80">
            {t('dashboard.spent.financed')}
          </Text>
          <MaskedAmount
            amount={financed}
            currency="ARS"
            className="text-[15px] font-extrabold text-white"
          />
        </View>
      </View>

      <View className="mt-3">
        <Caption phrase={t('dashboard.spent.caption', { financed: fmt(financed) })} />
      </View>
    </View>
  )
}
