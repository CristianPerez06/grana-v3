'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { formatARS } from '@grana/i18n-messages'
import { getMonthBalanceSeries } from '@grana/dashboard'
import { getMonthCategoryBreakdown } from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { useShowCents } from '@/lib/preferences-context'
import { useDashboardMonth } from './dashboard-month-context'
import { useEyeMask } from './eye-mask-context'

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

// Full-width bridge between "Balance del mes" (CAJA) and "Comprometido": of what
// you spent this month, how much was financed on the card (and thus didn't leave
// your cash). `financiado = total devengado − gasto de caja`, so the three
// numbers reconcile. Month-scoped (follows the navigator); reuses the SAME query
// keys as the two sections, so it reads their cache (TanStack dedupes). Renders
// nothing when there was no card spend.
export const FinancedOnCardNote = () => {
  const t = useTranslations('dashboard.month')
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
    queryFn: () => getMonthCategoryBreakdown(createClient(), monthKey(selected.year, selected.month)),
    staleTime: 60_000,
  })

  const cash = balanceQuery.data?.ARS.totalExpense ?? 0
  const accrued = (breakdownQuery.data?.ARS ?? []).reduce((sum, slice) => sum + slice.value, 0)
  const financed = Math.round((accrued - cash) * 100) / 100
  if (financed <= 0) return null

  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, showCents))

  return (
    <p className="rounded-2xl border border-navy-border/40 bg-navy-soft px-4 py-3 text-[13px] leading-snug text-navy shadow-sm">
      {t('financed_on_card', {
        total: fmt(accrued),
        cash: fmt(cash),
        financed: fmt(financed),
      })}
    </p>
  )
}
