import { Text, View } from 'react-native'
import type { MonthBalanceSeries } from '@grana/dashboard'
import { t } from '../../lib/i18n'
import { MaskedAmount } from './MaskedAmount'
import { MonthBalanceChart } from './MonthBalanceChart'
import { MonthNavigator } from './MonthNavigator'

type Props = {
  data: MonthBalanceSeries
  currentYear: number
  currentMonth: number
  monthsBackLimit?: number
}

function toParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function diffMonths(year1: number, month1: number, year2: number, month2: number): number {
  return (year1 - year2) * 12 + (month1 - month2)
}

function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export const MonthBalanceSection = ({
  data,
  currentYear,
  currentMonth,
  monthsBackLimit = 12,
}: Props) => {
  const monthsBack = diffMonths(currentYear, currentMonth, data.year, data.month)
  const canGoBack = monthsBack < monthsBackLimit
  const canGoForward = monthsBack > 0

  const prev = canGoBack ? addMonth(data.year, data.month, -1) : null
  const next = canGoForward ? addMonth(data.year, data.month, +1) : null

  const prevHref = prev ? `/dashboard?month=${toParam(prev.year, prev.month)}` : undefined
  const nextHref = next ? `/dashboard?month=${toParam(next.year, next.month)}` : undefined

  const isPositive = data.finalBalance >= 0
  const balanceColor = isPositive ? 'text-emerald' : 'text-negative'

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-center justify-between gap-4">
        <Text className="text-lg font-semibold text-text">{t('dashboard.month.title')}</Text>
        <MonthNavigator
          year={data.year}
          month={data.month}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </View>

      <View className="mb-3">
        <MonthBalanceChart days={data.days} />
      </View>

      <View className="mt-4 flex-row flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4">
        <View>
          <Text className="text-xs font-medium uppercase text-text-muted">
            {t('dashboard.month.final_balance')}
          </Text>
          <View className="mt-1 flex-row items-baseline">
            <Text className={`text-2xl font-bold ${balanceColor}`}>
              {isPositive && data.finalBalance > 0 ? '+ ' : ''}
            </Text>
            <MaskedAmount
              amount={data.finalBalance}
              currency="ARS"
              className={`text-2xl font-bold ${balanceColor}`}
            />
          </View>
        </View>
        <View className="flex-row gap-4">
          <View className="flex-row items-baseline">
            <Text className="text-xs text-text-muted">{t('dashboard.month.income')} </Text>
            <MaskedAmount
              amount={data.totalIncome}
              currency="ARS"
              className="text-xs font-semibold text-text"
            />
          </View>
          <View className="flex-row items-baseline">
            <Text className="text-xs text-text-muted">{t('dashboard.month.expense')} </Text>
            <MaskedAmount
              amount={data.totalExpense}
              currency="ARS"
              className="text-xs font-semibold text-text"
            />
          </View>
        </View>
      </View>
    </View>
  )
}
