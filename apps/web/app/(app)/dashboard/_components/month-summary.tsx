'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  deriveMonthSummary,
  getMonthBalanceSeries,
  type MonthBalanceByCurrency,
  type MonthSummary as MonthSummaryAmounts,
} from '@grana/dashboard'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MaskedAmount } from './masked-amount'
import { useDashboardMonth } from './dashboard-month-context'

type Props = {
  /** Current-month data, server-rendered by the container. Null when it failed. */
  initialData: MonthBalanceByCurrency | null
}

const Flow = ({
  label,
  dotClassName,
  amountClassName,
  ars,
  usd,
}: {
  label: string
  dotClassName: string
  amountClassName: string
  ars: number
  usd: number
}) => (
  <div className="flex flex-col items-center text-center">
    <span className="flex items-center gap-[9px] text-[15px] font-bold text-text-muted">
      <span aria-hidden className={cn('size-[9px] rounded-full', dotClassName)} />
      {label}
    </span>
    <span
      className={cn(
        'mt-2.5 text-[27px] font-extrabold leading-none tracking-[-0.04em]',
        amountClassName,
      )}
    >
      <MaskedAmount amount={ars} currency="ARS" />
    </span>
    {/* Bimoneda: the USD line only shows when there is money in dollars. */}
    {usd !== 0 && (
      <span className="mt-[5px] text-[13px] font-semibold text-text-soft">
        <MaskedAmount amount={usd} currency="USD" showCentsOverride />
      </span>
    )}
  </div>
)

/**
 * "Resumen del mes" — the light zone of the balance card: what came in and what
 * went out of the accounts, in two centered columns.
 *
 * Client-side because it follows the header's month selector, unlike the dark
 * zone above it, which always shows today's balance. Reuses the SAME query key
 * as "Gastaste este mes" so TanStack dedupes and the month costs one fetch.
 */
export const MonthSummary = ({ initialData }: Props) => {
  const t = useTranslations('dashboard.month')
  const { selected } = useDashboardMonth()

  const isInitialMonth =
    initialData != null &&
    initialData.year === selected.year &&
    initialData.month === selected.month

  const { data } = useQuery({
    queryKey: ['dashboard', 'balance-series', selected.year, selected.month],
    queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month),
    initialData: isInitialMonth ? initialData : undefined,
    staleTime: 60_000,
  })

  const zero: MonthSummaryAmounts = { entro: 0, seFue: 0 }
  const summary = data ? deriveMonthSummary(data) : { ARS: zero, USD: zero }

  return (
    <div className="border-t border-border px-[26px] pb-5 pt-5">
      <h3 className="text-[18px] font-extrabold tracking-[-0.025em] text-text">
        {t('summary_title')}
      </h3>
      <div className="mx-auto mt-[15px] grid max-w-[660px] grid-cols-2 gap-[18px]">
        <Flow
          label={t('came_in')}
          dotClassName="bg-emerald"
          amountClassName="text-emerald-deep"
          ars={summary.ARS.entro}
          usd={summary.USD.entro}
        />
        <Flow
          label={t('went_out')}
          dotClassName="bg-slate"
          amountClassName="text-slate"
          ars={summary.ARS.seFue}
          usd={summary.USD.seFue}
        />
      </div>
    </div>
  )
}
