'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MaskedAmount } from './masked-amount'
import { MonthBalanceChart } from './month-balance-chart'
import { MonthNavigator } from './month-navigator'
import { fetchMonthBalanceSeries } from '@/app/_actions/dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { MonthBalanceSeries } from '@grana/dashboard'
import { cn } from '@/lib/utils'

type Props = {
  initialData: MonthBalanceSeries
  currentYear: number
  currentMonth: number
  monthsBackLimit?: number
}

type Selected = { year: number; month: number }
type Status = 'idle' | 'loading' | 'error'

function diffMonths(year1: number, month1: number, year2: number, month2: number): number {
  return (year1 - year2) * 12 + (month1 - month2)
}

function addMonth(year: number, month: number, delta: number): Selected {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export const MonthBalanceSection = ({
  initialData,
  currentYear,
  currentMonth,
  monthsBackLimit = 12,
}: Props) => {
  const t = useTranslations('dashboard.month')
  const tError = useTranslations('error')

  const [selected, setSelected] = useState<Selected>({
    year: initialData.year,
    month: initialData.month,
  })
  const [data, setData] = useState<MonthBalanceSeries>(initialData)
  const [status, setStatus] = useState<Status>('idle')

  // Monotonic token so out-of-order responses from fast clicks are discarded:
  // only the latest request is allowed to commit its result.
  const requestRef = useRef(0)

  const load = (target: Selected) => {
    const token = ++requestRef.current
    setSelected(target)
    setStatus('loading')
    fetchMonthBalanceSeries(target.year, target.month)
      .then((series) => {
        if (requestRef.current !== token) return
        setData(series)
        setStatus('idle')
      })
      .catch(() => {
        if (requestRef.current !== token) return
        setStatus('error')
      })
  }

  const monthsBack = diffMonths(currentYear, currentMonth, selected.year, selected.month)
  const canGoBack = monthsBack < monthsBackLimit
  const canGoForward = monthsBack > 0

  const onPrev = canGoBack
    ? () => load(addMonth(selected.year, selected.month, -1))
    : undefined
  const onNext = canGoForward
    ? () => load(addMonth(selected.year, selected.month, +1))
    : undefined

  const isPositive = data.finalBalance >= 0

  return (
    <Card className="flex h-full min-h-[26rem] flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <h2 className="min-w-0 truncate text-lg font-semibold text-text">{t('title')}</h2>
        <MonthNavigator
          year={selected.year}
          month={selected.month}
          onPrev={onPrev}
          onNext={onNext}
        />
      </CardHeader>

      {/* Swappable region — only the graph + footer change between states; the
          card keeps its size because this region always fills the card body
          (flex-1) with a stable minimum height. */}
      <CardContent className="flex flex-1 flex-col">
        {status === 'loading' ? (
          <div
            className="flex min-h-[17.5rem] flex-1 items-center justify-center"
            aria-busy="true"
          >
            <Spinner size="lg" />
          </div>
        ) : status === 'error' ? (
          <div className="flex min-h-[17.5rem] flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-text-muted">{t('error')}</p>
            <Button variant="secondary" size="sm" className="w-auto px-4" onPress={() => load(selected)}>
              {tError('retry_action')}
            </Button>
          </div>
        ) : (
          <div className="flex min-h-[17.5rem] flex-1 flex-col">
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
