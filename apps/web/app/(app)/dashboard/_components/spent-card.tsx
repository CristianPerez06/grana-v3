'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Clock, CreditCard, ShoppingBag } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import {
  deriveMonthSpending,
  deriveSpendingPace,
  getMonthBalanceSeries,
  type SpendingPace,
} from '@grana/dashboard'
import { getMonthCategoryBreakdown } from '@/lib/transactions/queries'
import { createClient } from '@/lib/supabase/client'
import { useShowCents } from '@/lib/preferences-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useDashboardMonth } from './dashboard-month-context'
import { useEyeMask } from './eye-mask-context'
import { MaskedAmount } from './masked-amount'

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

type TileTone = 'spent' | 'paid' | 'pending'

const TILE_TONE: Record<TileTone, { icon: string; amount: string; rule: string }> = {
  spent: { icon: 'bg-emerald-bg text-emerald-deep', amount: 'text-emerald-deep', rule: 'bg-emerald-deep' },
  paid: { icon: 'bg-slate-soft text-slate', amount: 'text-slate', rule: 'bg-slate' },
  pending: { icon: 'bg-warning-soft text-warning-deep', amount: 'text-warning-deep', rule: 'bg-warning-deep' },
}

const Tile = ({
  tone,
  icon,
  label,
  ars,
  usd,
  subLead,
  subEmphasis,
}: {
  tone: TileTone
  icon: React.ReactNode
  label: string
  ars: number
  usd: number
  subLead: string
  subEmphasis: string
}) => (
  <div className="flex flex-col overflow-hidden rounded-2xl border border-border text-center">
    <div className="flex flex-1 flex-col items-center px-3 pt-3.5">
      <span
        aria-hidden
        className={cn('flex size-9 items-center justify-center rounded-xl', TILE_TONE[tone].icon)}
      >
        {icon}
      </span>
      <span className="mt-2 text-[12.5px] font-extrabold text-text-muted">{label}</span>
      <span
        className={cn(
          'mt-1 text-[20px] font-extrabold tracking-[-0.04em]',
          TILE_TONE[tone].amount,
        )}
      >
        <MaskedAmount amount={ars} currency="ARS" />
      </span>
      {/* Bimoneda: only when there is money in dollars. */}
      {usd !== 0 && (
        <span className="mt-0.5 text-[11px] font-semibold text-text-soft">
          <MaskedAmount amount={usd} currency="USD" showCentsOverride />
        </span>
      )}
    </div>
    {/* Sub-block: the three amounts are all "spend", so each says what it measures. */}
    <div className="mt-3 border-t border-border-soft px-3 pb-3 pt-2.5 text-[11px] font-bold leading-tight text-text-soft">
      {subLead}
      <br />
      <span className="text-[11.5px] font-extrabold text-text">{subEmphasis}</span>
    </div>
    <span aria-hidden className={cn('h-1 w-full', TILE_TONE[tone].rule)} />
  </div>
)

const PaceStrip = ({ pace }: { pace: SpendingPace }) => {
  const t = useTranslations('dashboard.spent')
  const { masked } = useEyeMask()
  const showCents = useShowCents()
  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, showCents))

  // No income yet → the ratio has no denominator. Saying "0%" would read as
  // "you spent nothing", so the strip explains itself instead of drawing a ring.
  if (pace.status === 'indeterminate') {
    return (
      <div className="mt-auto rounded-2xl border border-border bg-surface-sunken p-4">
        <p className="text-[13.5px] font-bold text-text-muted">{t('pace_unknown')}</p>
        <p className="mt-1 text-[11.5px] font-semibold text-text-soft">{t('pace_unknown_note')}</p>
      </div>
    )
  }

  const over = pace.status === 'over'
  const ringColor = over ? 'var(--terracotta)' : 'var(--emerald)'

  return (
    <div className="mt-auto flex items-center gap-4 rounded-2xl border border-border bg-surface-sunken p-4">
      <div
        aria-hidden
        className="relative size-[54px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${ringColor} 0 ${pace.fillPct}%, var(--border-soft) ${pace.fillPct}% 100%)`,
        }}
      >
        <span className="absolute inset-[8px] flex items-center justify-center rounded-full bg-surface-sunken text-[13px] font-extrabold">
          <span className={over ? 'text-expense' : 'text-emerald-deep'}>{pace.pct}%</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {/* Plain interpolation, not `t.rich`: `{pct}` is a value in the message,
            not a tag, and the same key is read by the native app, whose
            translator has no tag support. The ring already carries the number
            in colour, so emphasising it again in the sentence adds nothing. */}
        <p className="text-[13.5px] font-bold text-text-muted">
          {t(over ? 'pace_over' : 'pace', { pct: `${pace.pct}%` })}
        </p>
        <div className="mt-2 h-[7px] overflow-hidden rounded-[5px] bg-border-soft">
          <div
            className={cn('h-full rounded-[5px]', over ? 'bg-terracotta' : 'bg-emerald')}
            style={{ width: `${pace.fillPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11.5px] font-semibold text-text-soft">
          {t('pace_foot', { spent: fmt(pace.spent), income: fmt(pace.income) })}
        </p>
      </div>
    </div>
  )
}

/**
 * "Cuánto gastaste" — the month's expense broken into three named amounts plus
 * the pace strip.
 *
 * Gastaste (everything accrued) = Pagaste (already left the accounts) + Te queda
 * por pagar (financed on a credit card). The card renders whenever the month has
 * spending, INCLUDING when nothing is left to pay: a zero there is the good news,
 * and a card that vanishes depending on the month you are looking at is worse
 * than a card showing zero.
 *
 * Reuses the same query keys as the balance card so the month costs no extra
 * fetch.
 */
export const SpentCard = () => {
  const t = useTranslations('dashboard.spent')
  const { selected } = useDashboardMonth()

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

  const accruedOf = (currency: 'ARS' | 'USD') =>
    (breakdownQuery.data?.[currency] ?? []).reduce((sum, slice) => sum + slice.value, 0)

  const ars = deriveMonthSpending(accruedOf('ARS'), balanceQuery.data?.ARS.totalExpense ?? 0)
  const usd = deriveMonthSpending(accruedOf('USD'), balanceQuery.data?.USD.totalExpense ?? 0)
  const pace = deriveSpendingPace(ars.gastaste, balanceQuery.data?.ARS.totalIncome ?? 0)

  const isEmpty = ars.gastaste === 0 && usd.gastaste === 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-text">{t('title')}</h2>
        <Link
          href="/transactions"
          className="rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('view_detail')} ›
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {isEmpty ? (
          <p className="py-6 text-center text-[13.5px] font-semibold text-text-soft">
            {t('empty')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <Tile
                tone="spent"
                icon={<ShoppingBag size={18} strokeWidth={2} aria-hidden />}
                label={t('gastaste')}
                ars={ars.gastaste}
                usd={usd.gastaste}
                subLead={t('gastaste_sub_1')}
                subEmphasis={t('gastaste_sub_2')}
              />
              <Tile
                tone="paid"
                icon={<CreditCard size={18} strokeWidth={2} aria-hidden />}
                label={t('pagaste')}
                ars={ars.pagaste}
                usd={usd.pagaste}
                subLead={t('pagaste_sub_1')}
                subEmphasis={t('pagaste_sub_2')}
              />
              <Tile
                tone="pending"
                icon={<Clock size={18} strokeWidth={2} aria-hidden />}
                label={t('pending')}
                ars={ars.teQuedaPorPagar}
                usd={usd.teQuedaPorPagar}
                subLead={t('pending_sub_1')}
                subEmphasis={t('pending_sub_2')}
              />
            </div>

            <PaceStrip pace={pace} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
