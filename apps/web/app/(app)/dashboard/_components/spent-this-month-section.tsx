'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { formatARS } from '@grana/i18n-messages'
import { getMonthBalanceSeries } from '@grana/dashboard'
import { getMonthCategoryBreakdown } from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { useShowCents } from '@/lib/preferences-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useDashboardMonth } from './dashboard-month-context'
import { useEyeMask } from './eye-mask-context'
import { MaskedAmount } from './masked-amount'

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

// "Gastaste este mes" — CAJA → CONSUMO bridge as a proportional bar: of what you
// spent this month (devengado), how much left your cash vs. how much was financed
// on the card (`financiado = total devengado − gasto de caja`, so the three
// reconcile). Month-scoped (follows the navigator); reuses the SAME query keys as
// "Balance del mes" and "¿En qué gasté?" so TanStack dedupes (no extra fetch).
// Renders nothing when there was no card spend.
export const SpentThisMonthSection = () => {
  const t = useTranslations('dashboard.spent')
  const { selected } = useDashboardMonth()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const balanceQuery = useQuery({
    queryKey: ['dashboard', 'balance-series', selected.year, selected.month],
    queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month),
    staleTime: 60_000,
  })
  const breakdownQuery = useQuery({
    queryKey: ['dashboard', 'category-breakdown', selected.year, selected.month],
    queryFn: () =>
      getMonthCategoryBreakdown(createClient(), monthKey(selected.year, selected.month)),
    staleTime: 60_000,
  })

  const cash = balanceQuery.data?.ARS.totalExpense ?? 0
  const accrued = (breakdownQuery.data?.ARS ?? []).reduce((sum, slice) => sum + slice.value, 0)
  const financed = Math.round((accrued - cash) * 100) / 100
  if (financed <= 0) return null

  const cashPct = (cash / accrued) * 100
  const financedPct = (financed / accrued) * 100
  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, showCents))

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-text">{t('title')}</h2>
        <span className="text-[18px] font-extrabold tracking-tight tabular-nums text-text">
          <MaskedAmount amount={accrued} currency="ARS" />
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Proportional bar — segments scale by their share; stacks on mobile. */}
        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl sm:flex-row">
          <div
            className="flex min-h-[3.5rem] flex-col justify-center gap-0.5 bg-slate px-4 py-3 text-white"
            style={{ flexGrow: cashPct, flexBasis: 0 }}
          >
            <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-white/80">
              {t('from_cash')}
            </span>
            <span className="text-[15px] font-extrabold tracking-tight tabular-nums">
              <MaskedAmount amount={cash} currency="ARS" />
            </span>
          </div>
          <div
            className="flex min-h-[3.5rem] flex-col justify-center gap-0.5 bg-terracotta px-4 py-3 text-white"
            style={{ flexGrow: financedPct, flexBasis: 0 }}
          >
            <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-white/80">
              {t('financed')}
            </span>
            <span className="text-[15px] font-extrabold tracking-tight tabular-nums">
              <MaskedAmount amount={financed} currency="ARS" />
            </span>
          </div>
        </div>

        <p className="text-[12.5px] leading-snug text-text-muted">
          {t.rich('caption', {
            b: (chunks) => <strong className="font-extrabold text-text">{chunks}</strong>,
            financed: fmt(financed),
          })}
        </p>
      </CardContent>
    </Card>
  )
}
