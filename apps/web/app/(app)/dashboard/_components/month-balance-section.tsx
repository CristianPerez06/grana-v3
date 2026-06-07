'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { formatARS } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'
import { MonthBalanceBodySkeleton } from './month-balance-skeleton'
import { useDashboardMonth } from './dashboard-month-context'
import { useEyeMask } from './eye-mask-context'
import { fetchMonthBalanceSeries } from '@/app/_actions/dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { MonthBalanceByCurrency, MonthBalanceSeries } from '@grana/dashboard'
import { cn } from '@/lib/utils'

type Props = {
  /** Current-month data, server-rendered by the container. */
  initialData: MonthBalanceByCurrency
}

// One Ingresos/Gastos row: dot + label + amount, proportional bar below. The
// widths are data-derived: the larger flow fills the track, the other scales.
const FlowRow = ({
  label,
  amount,
  widthPct,
  tone,
}: {
  label: string
  amount: number
  widthPct: number
  tone: 'income' | 'expense'
}) => (
  <div>
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[13.5px] font-semibold text-text-muted">
        <span
          aria-hidden
          className={cn(
            'size-[9px] rounded-full',
            tone === 'income' ? 'bg-emerald' : 'bg-terracotta',
          )}
        />
        {label}
      </span>
      <span className="text-[14.5px] font-extrabold tracking-tight text-text">
        <MaskedAmount amount={amount} currency="ARS" />
      </span>
    </div>
    <div className="mt-1.5 h-[11px] overflow-hidden rounded-md bg-border-soft">
      <div
        className={cn(
          'h-full rounded-md transition-[width] duration-[var(--duration-slow)]',
          tone === 'income' ? 'bg-emerald' : 'bg-terracotta',
        )}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  </div>
)

const MonthBalanceBody = ({ data }: { data: MonthBalanceByCurrency }) => {
  const t = useTranslations('dashboard.month')
  const { masked } = useEyeMask()
  const ars: MonthBalanceSeries = data.ARS
  const usd: MonthBalanceSeries = data.USD

  const isPositive = ars.finalBalance >= 0
  const usdIsPositive = usd.finalBalance >= 0

  const maxFlow = Math.max(ars.totalIncome, ars.totalExpense)
  const incomeWidth = maxFlow > 0 ? (ars.totalIncome / maxFlow) * 100 : 0
  const expenseWidth = maxFlow > 0 ? (ars.totalExpense / maxFlow) * 100 : 0

  return (
    <div className="flex min-h-[15rem] flex-1 flex-col">
      {/* Net of the month */}
      <p className="text-xs font-extrabold uppercase tracking-wide text-text-soft">
        {t('final_balance')}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[clamp(1.875rem,3.8vw,2.375rem)] font-extrabold leading-none tracking-tight',
          isPositive ? 'text-income' : 'text-expense',
        )}
      >
        <MaskedAmountDisplay
          amount={ars.finalBalance}
          currency="ARS"
          signPrefix={ars.finalBalance > 0 ? '+' : undefined}
        />
      </p>

      {/* Ingresos / Gastos with proportional bars */}
      <div className="mt-5 flex flex-col gap-3.5">
        <FlowRow
          label={t('income')}
          amount={ars.totalIncome}
          widthPct={incomeWidth}
          tone="income"
        />
        <FlowRow
          label={t('expense')}
          amount={ars.totalExpense}
          widthPct={expenseWidth}
          tone="expense"
        />
      </div>

      {/* USD strip — always shown (bimoneda por defecto); zeros when idle */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-3.5">
        <span className="rounded-full bg-emerald-soft px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-deep">
          USD
        </span>
        <span
          className={cn(
            'text-[17px] font-extrabold tracking-tight',
            usdIsPositive ? 'text-income' : 'text-expense',
          )}
        >
          {!masked && usd.finalBalance > 0 ? '+' : ''}
          <MaskedAmount amount={usd.finalBalance} currency="USD" showCentsOverride />
        </span>
        <span className="ml-auto text-[12.5px] font-semibold text-text-muted">
          {t('income')}{' '}
          <MaskedAmount amount={usd.totalIncome} currency="USD" showCentsOverride />
          {' · '}
          {t('expense')}{' '}
          <MaskedAmount amount={usd.totalExpense} currency="USD" showCentsOverride />
        </span>
      </div>
    </div>
  )
}

// "Balance del mes" — net + flows + USD strip for the month selected in the
// header navigator (shared DashboardMonthProvider). The current month arrives
// server-rendered (seeded into the query cache); any other month is fetched
// client-side with an in-card loading/error state, so the page never navigates.
export const MonthBalanceSection = ({ initialData }: Props) => {
  const t = useTranslations('dashboard.month')
  const tDashboard = useTranslations('dashboard')
  const tError = useTranslations('error')
  const { selected, isCurrent } = useDashboardMonth()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'balance-series', selected.year, selected.month],
    queryFn: () => fetchMonthBalanceSeries(selected.year, selected.month),
    // The current month is server-rendered by the container; other months
    // start empty and show the in-card skeleton while they fetch.
    initialData: isCurrent ? initialData : undefined,
    staleTime: 60_000,
  })

  // "vas +$X este mes" — always the CURRENT month (initialData is the
  // server-rendered current month), so it keeps anchoring "this month" even
  // while the navigator browses past months. No extra fetch involved.
  const currentNet = initialData.ARS.finalBalance
  const currentNetLabel = masked
    ? '••••••'
    : `${currentNet > 0 ? '+' : ''}${formatARS(currentNet, showCents)}`

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="min-w-0 truncate text-lg font-semibold text-text">{t('title')}</h2>
        <p className="text-sm text-text-muted sm:shrink-0">
          {tDashboard.rich('net_this_month', {
            net: currentNetLabel,
            amount: (chunks) => (
              <span
                className={cn(
                  'font-bold tabular-nums',
                  currentNet < 0 ? 'text-expense' : 'text-income',
                )}
              >
                {chunks}
              </span>
            ),
          })}
        </p>
      </CardHeader>

      {/* Swappable region — keeps a stable minimum height across the loading,
          error and data states so the card never shifts layout. */}
      <CardContent className="flex flex-1 flex-col">
        {isPending ? (
          <div aria-busy="true" aria-label={t('loading')}>
            <MonthBalanceBodySkeleton />
          </div>
        ) : isError ? (
          <div className="flex min-h-[15rem] flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-text-muted">{t('error')}</p>
            <Button
              variant="secondary"
              size="sm"
              className="w-auto px-4"
              onPress={() => void refetch()}
            >
              {tError('retry_action')}
            </Button>
          </div>
        ) : (
          <MonthBalanceBody data={data} />
        )}
      </CardContent>
    </Card>
  )
}
