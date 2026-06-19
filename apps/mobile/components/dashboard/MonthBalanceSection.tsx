import { Text, View } from 'react-native'
import { formatARS } from '@grana/i18n-messages'
import type { MonthBalanceSeries } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { useMonthBalanceSeries } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { useDashboardMonth } from './DashboardMonthContext'
import { useEyeMask } from './EyeMaskContext'
import { MaskedAmount } from './MaskedAmount'
import { MaskedAmountDisplay } from './MaskedAmountDisplay'
import { MonthBalanceSkeleton } from './MonthBalanceSkeleton'

// Net + flow rows + USD strip keep the card a stable size while loading/error
// replace them; the swap region never collapses below this.
const SWAP_MIN_HEIGHT = 240

// One Ingresos/Gastos row: dot + label + amount, proportional bar below. The
// widths are data-derived: the larger flow fills the track, the other scales.
const FLOW_TONE: Record<'income' | 'expense' | 'adjustment', string> = {
  income: 'bg-emerald',
  expense: 'bg-terracotta',
  adjustment: 'bg-warning',
}

const FlowRow = ({
  label,
  amount,
  widthPct,
  tone,
  chip,
}: {
  label: string
  amount: number
  widthPct: number
  tone: 'income' | 'expense' | 'adjustment'
  /** Optional pill next to the label (e.g. "Sin registrar" for adjustments). */
  chip?: string
}) => (
  <View>
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-row items-center gap-2">
        <View className={`h-[9px] w-[9px] rounded-full ${FLOW_TONE[tone]}`} />
        <Text className="text-[13px] font-semibold text-text-muted">{label}</Text>
        {chip ? (
          <View className="rounded-full bg-warning/15 px-2 py-0.5">
            <Text className="text-[10px] font-extrabold uppercase text-warning-deep">{chip}</Text>
          </View>
        ) : null}
      </View>
      <MaskedAmount
        amount={amount}
        currency="ARS"
        className="text-sm font-extrabold text-text"
      />
    </View>
    <View className="mt-1.5 h-[11px] overflow-hidden rounded-md bg-border-soft">
      <View
        className={`h-full rounded-md ${FLOW_TONE[tone]}`}
        style={{ width: `${widthPct}%` }}
      />
    </View>
  </View>
)

// "vas <amount>{net}</amount> este mes" — the catalog key carries rich tags
// (web renders them via t.rich); native splits the tagged string and styles
// the inner part with a nested Text.
const NetThisMonth = ({ phrase, color }: { phrase: string; color: string }) => {
  const match = phrase.match(/^(.*)<amount>(.*)<\/amount>(.*)$/)
  if (!match) return <Text className="text-sm text-text-muted">{phrase}</Text>
  const [, before, inner, after] = match
  return (
    <Text className="text-sm text-text-muted">
      {before}
      <Text className={`font-bold tabular-nums ${color}`}>{inner}</Text>
      {after}
    </Text>
  )
}

// "Balance del mes" — net + flows + USD strip for the month selected in the
// header navigator (shared DashboardMonthProvider mirror). The card header
// anchors "vas {neto} este mes" to the CURRENT month while past months are
// browsed; that data comes from the TanStack cache of the first load.
export const MonthBalanceSection = () => {
  const t = useT()
  const { selected, current } = useDashboardMonth()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const query = useMonthBalanceSeries(selected.year, selected.month)
  const currentQuery = useMonthBalanceSeries(current.year, current.month)
  const data = query.data

  const currentNet = currentQuery.data?.ARS.finalBalance

  const netLabel =
    currentNet === undefined
      ? null
      : masked
        ? '••••••'
        : `${currentNet > 0 ? '+' : ''}${formatARS(currentNet, showCents)}`

  const ars: MonthBalanceSeries | undefined = data?.ARS
  const usd: MonthBalanceSeries | undefined = data?.USD
  const isPositive = ars ? ars.finalBalance >= 0 : true
  const usdIsPositive = usd ? usd.finalBalance >= 0 : true

  // Adjustments are a stock correction, not flow: their own row, only when the
  // month has any. The bar shares the scale with Ingresos/Gastos for a uniform
  // look (width uses the absolute net, since the amount can be negative).
  const hasAdjustment = ars ? ars.totalAdjustment !== 0 : false
  const adjustmentAbs = ars ? Math.abs(ars.totalAdjustment) : 0

  const maxFlow = ars ? Math.max(ars.totalIncome, ars.totalExpense, adjustmentAbs) : 0
  const incomeWidth = ars && maxFlow > 0 ? (ars.totalIncome / maxFlow) * 100 : 0
  const expenseWidth = ars && maxFlow > 0 ? (ars.totalExpense / maxFlow) * 100 : 0
  const adjustmentWidth = maxFlow > 0 ? (adjustmentAbs / maxFlow) * 100 : 0

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="flex-shrink text-lg font-semibold text-text">
          {t('dashboard.month.title')}
        </Text>
        {netLabel !== null && (
          <NetThisMonth
            phrase={t('dashboard.net_this_month', { net: netLabel })}
            color={
              currentNet !== undefined && currentNet < 0 ? 'text-negative' : 'text-emerald'
            }
          />
        )}
      </View>

      {/* Swappable region — keeps a stable minimum height across the loading,
          error and data states so the card never shifts layout. */}
      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {ars && usd ? (
          <View className="flex-1">
            {/* Net of the month */}
            <Text className="text-xs font-extrabold uppercase text-text-soft">
              {t('dashboard.month.final_balance')}
            </Text>
            <View className="mt-1.5">
              <MaskedAmountDisplay
                amount={ars.finalBalance}
                currency="ARS"
                signPrefix={ars.finalBalance > 0 ? '+' : undefined}
                className={`text-[30px] font-extrabold ${
                  isPositive ? 'text-emerald' : 'text-negative'
                }`}
                decimalClassName="text-[15px] opacity-55"
              />
            </View>

            {/* Ingresos / Gastos with proportional bars */}
            <View className="mt-5 gap-3.5">
              <FlowRow
                label={t('dashboard.month.income')}
                amount={ars.totalIncome}
                widthPct={incomeWidth}
                tone="income"
              />
              <FlowRow
                label={t('dashboard.month.expense')}
                amount={ars.totalExpense}
                widthPct={expenseWidth}
                tone="expense"
              />
              {/* Ajustes — stock correction, not flow. Same bar treatment as
                  the flows for a uniform look, but only when the month has any. */}
              {hasAdjustment && (
                <FlowRow
                  label={t('dashboard.month.adjustment')}
                  amount={ars.totalAdjustment}
                  widthPct={adjustmentWidth}
                  tone="adjustment"
                  chip={t('dashboard.month.adjustment_unregistered')}
                />
              )}
            </View>

            {/* Grana-voice note under the bar: adjustments are untracked money. */}
            {hasAdjustment && (
              <Text className="mt-2.5 text-[12px] leading-snug text-warning-deep">
                {t('dashboard.month.adjustment_note')}
              </Text>
            )}

            {/* USD strip — always shown (bimoneda por defecto); zeros when idle */}
            <View className="mt-5 flex-row flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-3.5">
              <View className="rounded-full bg-emerald-soft px-2.5 py-0.5">
                <Text className="text-[11px] font-extrabold text-emerald-deep">USD</Text>
              </View>
              <View className="flex-row items-baseline">
                <Text
                  className={`text-[17px] font-extrabold ${
                    usdIsPositive ? 'text-emerald' : 'text-negative'
                  }`}
                >
                  {!masked && usd.finalBalance > 0 ? '+' : ''}
                </Text>
                <MaskedAmount
                  amount={usd.finalBalance}
                  currency="USD"
                  showCentsOverride
                  className={`text-[17px] font-extrabold ${
                    usdIsPositive ? 'text-emerald' : 'text-negative'
                  }`}
                />
              </View>
              <View className="ml-auto flex-row items-baseline">
                <Text className="text-xs font-semibold text-text-muted">
                  {t('dashboard.month.income')}{' '}
                </Text>
                <MaskedAmount
                  amount={usd.totalIncome}
                  currency="USD"
                  showCentsOverride
                  className="text-xs font-semibold text-text-muted"
                />
                <Text className="text-xs font-semibold text-text-muted"> · </Text>
                <Text className="text-xs font-semibold text-text-muted">
                  {t('dashboard.month.expense')}{' '}
                </Text>
                <MaskedAmount
                  amount={usd.totalExpense}
                  currency="USD"
                  showCentsOverride
                  className="text-xs font-semibold text-text-muted"
                />
              </View>
            </View>
          </View>
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.month.error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <MonthBalanceSkeleton />
        )}
      </View>
    </View>
  )
}
