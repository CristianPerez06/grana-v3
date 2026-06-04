import { useState } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { useMonthBalanceSeries } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { MaskedAmount } from './MaskedAmount'
import { MonthBalanceChart } from './MonthBalanceChart'
import { MonthBalanceSkeleton } from './MonthBalanceSkeleton'
import { MonthNavigator } from './MonthNavigator'

type Props = {
  currentYear: number
  currentMonth: number
  monthsBackLimit?: number
}

type Selected = { year: number; month: number }

// Graph (200) + footer keep the card a stable size while loading/error
// replace them; the swap region never collapses below this.
const SWAP_MIN_HEIGHT = 280

function diffMonths(year1: number, month1: number, year2: number, month2: number): number {
  return (year1 - year2) * 12 + (month1 - month2)
}

function addMonth(year: number, month: number, delta: number): Selected {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export const MonthBalanceSection = ({
  currentYear,
  currentMonth,
  monthsBackLimit = 12,
}: Props) => {
  const t = useT()

  // The dashboard always opens on the current month; navigation is local state
  // (no `?month=` param), so changing month never unmounts the card.
  const [selected, setSelected] = useState<Selected>({
    year: currentYear,
    month: currentMonth,
  })

  const query = useMonthBalanceSeries(selected.year, selected.month)
  const data = query.data

  const monthsBack = diffMonths(currentYear, currentMonth, selected.year, selected.month)
  const canGoBack = monthsBack < monthsBackLimit
  const canGoForward = monthsBack > 0

  const onPrev = canGoBack
    ? () => setSelected((s) => addMonth(s.year, s.month, -1))
    : undefined
  const onNext = canGoForward
    ? () => setSelected((s) => addMonth(s.year, s.month, +1))
    : undefined

  const ars = data?.ARS
  const usd = data?.USD
  const hasUsd = !!usd && (usd.totalIncome !== 0 || usd.totalExpense !== 0)
  const isPositive = ars ? ars.finalBalance >= 0 : true
  const usdIsPositive = usd ? usd.finalBalance >= 0 : true
  const balanceColor = isPositive ? 'text-emerald' : 'text-negative'
  const usdBalanceColor = usdIsPositive ? 'text-emerald' : 'text-negative'

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-center justify-between gap-4">
        <Text
          numberOfLines={1}
          className="flex-shrink text-lg font-semibold text-text"
        >
          {t('dashboard.month.title')}
        </Text>
        <MonthNavigator
          year={selected.year}
          month={selected.month}
          onPrev={onPrev}
          onNext={onNext}
        />
      </View>

      {/* Swappable region — only the graph + footer change between states; the
          card keeps its size via a stable minimum height. */}
      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {ars ? (
          <>
            <View className="mb-3">
              <MonthBalanceChart ars={ars.days} usd={hasUsd ? usd!.days : null} />
            </View>

            {/* Legend — only when both currencies are on the chart. */}
            {hasUsd && (
              <View className="flex-row items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="h-0.5 w-4 rounded bg-emerald"
                    accessibilityElementsHidden
                  />
                  <Text className="text-[11px] text-text-muted">
                    {t('dashboard.month.legend_ars')}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="h-0 w-4 border-t-2 border-dashed"
                    style={{ borderColor: '#0EA5E9' }}
                    accessibilityElementsHidden
                  />
                  <Text className="text-[11px] text-text-muted">
                    {t('dashboard.month.legend_usd')}
                  </Text>
                </View>
              </View>
            )}

            {/* ARS totals (primary) */}
            <View className="mt-4 flex-row flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4">
              <View>
                <Text className="text-xs font-medium uppercase text-text-muted">
                  {t('dashboard.month.final_balance')}
                </Text>
                <View className="mt-1 flex-row items-baseline">
                  <Text className={`text-2xl font-bold ${balanceColor}`}>
                    {isPositive && ars.finalBalance > 0 ? '+ ' : ''}
                  </Text>
                  <MaskedAmount
                    amount={ars.finalBalance}
                    currency="ARS"
                    className={`text-2xl font-bold ${balanceColor}`}
                  />
                </View>
              </View>
              <View className="flex-row gap-4">
                <View className="flex-row items-baseline">
                  <Text className="text-xs text-text-muted">{t('dashboard.month.income')} </Text>
                  <MaskedAmount
                    amount={ars.totalIncome}
                    currency="ARS"
                    className="text-xs font-semibold text-text"
                  />
                </View>
                <View className="flex-row items-baseline">
                  <Text className="text-xs text-text-muted">{t('dashboard.month.expense')} </Text>
                  <MaskedAmount
                    amount={ars.totalExpense}
                    currency="ARS"
                    className="text-xs font-semibold text-text"
                  />
                </View>
              </View>
            </View>

            {/* USD totals (subordinate) — only when there's USD activity. */}
            {hasUsd && usd && (
              <View className="mt-3 flex-row flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-3">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-[11px] font-semibold uppercase" style={{ color: '#0EA5E9' }}>
                    USD
                  </Text>
                  <View className="flex-row items-baseline">
                    <Text className={`text-base font-bold ${usdBalanceColor}`}>
                      {usdIsPositive && usd.finalBalance > 0 ? '+ ' : ''}
                    </Text>
                    <MaskedAmount
                      amount={usd.finalBalance}
                      currency="USD"
                      showCentsOverride
                      className={`text-base font-bold ${usdBalanceColor}`}
                    />
                  </View>
                </View>
                <View className="flex-row gap-4">
                  <View className="flex-row items-baseline">
                    <Text className="text-xs text-text-muted">{t('dashboard.month.income')} </Text>
                    <MaskedAmount
                      amount={usd.totalIncome}
                      currency="USD"
                      showCentsOverride
                      className="text-xs font-semibold text-text"
                    />
                  </View>
                  <View className="flex-row items-baseline">
                    <Text className="text-xs text-text-muted">{t('dashboard.month.expense')} </Text>
                    <MaskedAmount
                      amount={usd.totalExpense}
                      currency="USD"
                      showCentsOverride
                      className="text-xs font-semibold text-text"
                    />
                  </View>
                </View>
              </View>
            )}
          </>
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
