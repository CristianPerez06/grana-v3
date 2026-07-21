'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { BalanceCurrency } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/client'
import { getSharedAccruedMovements, type SharedExpenseItem } from '@grana/shared'
import {
  groupSharedSpendingByCategory,
  sharedSpendingTotal,
  sharedReimbursementsTotal,
  sharedOwnNetShare,
} from '@/lib/shared/spending-breakdown'
import { translateCategoryLabel } from '@/lib/categories/display'
import { fmtMoney } from '../../_components/money'
import { SpendingBreakdown } from '../../_components/spending-breakdown'
import { useSharedMonth } from './shared-month-context'
import { CAT_FALLBACK, monthLabel } from './format'
import { HeroSkeleton } from './hero-skeleton'

type Props = {
  /** Current-month accrued movements, server-rendered by the container. */
  initialData: SharedExpenseItem[]
}

type Slice = { key: string; label: string; color: string; value: number; pct: number }

// Hero "Gasto del hogar · neto" for the month selected in the header navigator.
// The current month arrives server-rendered (seeded into the query cache); any
// other month is fetched client-side, so the page never navigates.
export const HeroSection = ({ initialData }: Props) => {
  const t = useTranslations('shared')
  const tRoot = useTranslations()
  const tError = useTranslations('error')
  const { selected, ym, isCurrent } = useSharedMonth()

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['shared', 'accrued', selected.year, selected.month],
    queryFn: () => getSharedAccruedMovements(createClient(), ym),
    initialData: isCurrent ? initialData : undefined,
    staleTime: 60_000,
  })

  if (isPending) return <HeroSkeleton />
  if (isError) {
    return (
      <article className="bg-hero-navy text-white relative flex min-h-[210px] flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-navy-border p-6 text-center shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
        <p className="text-sm text-navy-muted">{tError('generic_title')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
        >
          {tError('retry_action')}
        </button>
      </article>
    )
  }

  const spending = data
  const spendOf = (c: BalanceCurrency) => sharedSpendingTotal(spending, c)
  const reimbOf = (c: BalanceCurrency) => sharedReimbursementsTotal(spending, c)
  const netOf = (c: BalanceCurrency) => spendOf(c) - reimbOf(c)
  const netShareOf = (c: BalanceCurrency) => sharedOwnNetShare(spending, c)
  const monthExpenses = spending.filter((e) => e.kind === 'expense')

  const breakdownOf = (c: BalanceCurrency): Slice[] => {
    const total = spendOf(c)
    if (total <= 0) return []
    return groupSharedSpendingByCategory(spending, c).map((g, i) => ({
      key: g.categoryId ?? 'none',
      label:
        translateCategoryLabel(g.name, g.canonicalName, g.isSystem, tRoot) ??
        t('split.shared_label'),
      color: g.color ?? CAT_FALLBACK[i % CAT_FALLBACK.length],
      value: g.value,
      pct: (g.value / total) * 100,
    }))
  }
  const breakdownSlices: Record<BalanceCurrency, Slice[]> = {
    ARS: breakdownOf('ARS'),
    USD: breakdownOf('USD'),
  }
  const breakdownMovements = monthExpenses.map((e) => ({
    id: e.id,
    key: e.categoryId ?? 'none',
    currency: e.currencyCode,
    description: e.description,
    amount: e.amount,
  }))

  return (
    <article className="bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border p-5 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
          {t('dashboard.household_spend_net', { month: monthLabel(ym) })}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold">
          <span className="text-emerald-300">USD</span>
          <span className="tabular-nums text-white">{fmtMoney(netOf('USD'), 'USD')}</span>
          <span className="text-navy-muted">{t('dashboard.net_in_usd')}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:gap-x-8">
        <div>
          <span className="text-[11px] font-semibold text-navy-muted">{t('dashboard.net_cost')}</span>
          <span className="mt-1 block text-[28px] font-black leading-none tabular-nums text-white sm:text-[38px]">
            {fmtMoney(netOf('ARS'), 'ARS')}
          </span>
        </div>
        <div className="text-[12px] font-semibold leading-relaxed text-navy-muted">
          <div className="flex items-center justify-end gap-4">
            <span>{t('dashboard.gross_label')}</span>
            <b className="w-[104px] text-right tabular-nums text-white">{fmtMoney(spendOf('ARS'), 'ARS')}</b>
          </div>
          <div className="flex items-center justify-end gap-4">
            <span>{t('dashboard.reimb_label')}</span>
            <b className="w-[104px] text-right tabular-nums text-emerald-300">
              −{fmtMoney(reimbOf('ARS'), 'ARS')}
            </b>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-navy-muted">
        {t('dashboard.your_net_share', { amount: fmtMoney(netShareOf('ARS'), 'ARS') })}
      </p>
      {netShareOf('USD') > 0.01 && (
        <p className="mt-0.5 text-xs font-semibold text-emerald-300">
          {t('dashboard.your_net_share_usd', { amount: fmtMoney(netShareOf('USD'), 'USD') })}
        </p>
      )}
      <SpendingBreakdown
        slices={breakdownSlices}
        movements={breakdownMovements}
        fallbackLabel={t('split.shared_label')}
      />
    </article>
  )
}
