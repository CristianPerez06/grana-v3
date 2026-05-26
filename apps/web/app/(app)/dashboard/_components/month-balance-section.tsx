import { getTranslations } from 'next-intl/server'
import { MaskedAmount } from './masked-amount'
import { MonthBalanceChart } from './month-balance-chart'
import { MonthNavigator } from './month-navigator'
import type { MonthBalanceSeries } from '@grana/dashboard'
import { cn } from '@/lib/utils'

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

export const MonthBalanceSection = async ({
  data,
  currentYear,
  currentMonth,
  monthsBackLimit = 12,
}: Props) => {
  const t = await getTranslations('dashboard.month')

  const monthsBack = diffMonths(currentYear, currentMonth, data.year, data.month)
  const canGoBack = monthsBack < monthsBackLimit
  const canGoForward = monthsBack > 0

  const prev = canGoBack ? addMonth(data.year, data.month, -1) : null
  const next = canGoForward ? addMonth(data.year, data.month, +1) : null

  const prevHref = prev ? `/dashboard?month=${toParam(prev.year, prev.month)}` : undefined
  const nextHref = next ? `/dashboard?month=${toParam(next.year, next.month)}` : undefined

  const isPositive = data.finalBalance >= 0

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
        <MonthNavigator
          year={data.year}
          month={data.month}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </header>

      <div className="mb-3 flex-1 text-text-muted">
        <MonthBalanceChart days={data.days} />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('final_balance')}
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tabular-nums',
              isPositive ? 'text-emerald' : 'text-negative',
            )}
          >
            {isPositive && data.finalBalance > 0 ? '+ ' : ''}
            <MaskedAmount amount={data.finalBalance} currency="ARS" />
          </p>
        </div>
        <div className="flex gap-4 text-xs text-text-muted">
          <span>
            {t('income')}{' '}
            <span className="font-semibold text-text">
              <MaskedAmount amount={data.totalIncome} currency="ARS" />
            </span>
          </span>
          <span>
            {t('expense')}{' '}
            <span className="font-semibold text-text">
              <MaskedAmount amount={data.totalExpense} currency="ARS" />
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
