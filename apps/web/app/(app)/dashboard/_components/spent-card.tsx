'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ChevronDown, Clock, CreditCard, ShoppingBag } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import {
  deriveSpendingPace,
  getMonthBalanceSeries,
  getMonthSpending,
  type MonthSpendingSplit,
  type SpendingPace,
} from '@grana/dashboard'
import { createClient } from '@/lib/supabase/client'
import { useShowCents } from '@/lib/preferences-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useDashboardMonth } from './dashboard-month-context'
import { useEyeMask } from './eye-mask-context'
import { MaskedAmount } from './masked-amount'

type Props = {
  /** Household partner's first name, or null when there is no Compartido. */
  otherName: string | null
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

type TileTone = 'spent' | 'paid' | 'pending'

const TILE_TONE: Record<TileTone, { icon: string; amount: string; rule: string }> = {
  spent: { icon: 'bg-emerald-bg text-emerald-deep', amount: 'text-emerald-deep', rule: 'bg-emerald-deep' },
  paid: { icon: 'bg-slate-soft text-slate', amount: 'text-slate', rule: 'bg-slate' },
  pending: { icon: 'bg-warning-soft text-warning-deep', amount: 'text-warning-deep', rule: 'bg-warning-deep' },
}

/** One line of a tile's breakdown: what part of the amount, and whose it is. */
const BreakdownRow = ({ label, amount }: { label: string; amount: number }) => (
  <div className="flex items-baseline justify-between gap-1.5 text-[11px] leading-tight">
    <span className="min-w-0 truncate font-semibold text-text-soft">{label}</span>
    <span className="shrink-0 font-extrabold tabular-nums text-text">
      <MaskedAmount amount={amount} currency="ARS" />
    </span>
  </div>
)

const Tile = ({
  tone,
  icon,
  label,
  ars,
  usd,
  showUsd,
  breakdown,
  panelId,
  expanded,
}: {
  tone: TileTone
  icon: React.ReactNode
  label: string
  ars: number
  usd: number
  showUsd: boolean
  /** Null when this tile has nothing to break down (no Compartido, or "Gastaste"). */
  breakdown: Array<{ label: string; amount: number }> | null
  panelId: string
  expanded: boolean
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
        className={cn('mt-1 text-[20px] font-extrabold tracking-[-0.04em]', TILE_TONE[tone].amount)}
      >
        <MaskedAmount amount={ars} currency="ARS" />
      </span>
      {showUsd && (
        <span className="mt-0.5 text-[11px] font-semibold text-text-soft">
          <MaskedAmount amount={usd} currency="USD" showCentsOverride />
        </span>
      )}
    </div>

    {breakdown && (
      <div
        id={panelId}
        hidden={!expanded}
        className="mt-3 flex flex-col gap-1 border-t border-border-soft px-3 pb-3 pt-2.5 text-left"
      >
        {breakdown.map((row) => (
          <BreakdownRow key={row.label} label={row.label} amount={row.amount} />
        ))}
      </div>
    )}

    <span aria-hidden className={cn('mt-auto h-1 w-full', TILE_TONE[tone].rule)} />
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

  // The ratio ran off the scale (a month whose income was cents). There IS a
  // denominator, so this is not "indeterminate" — but neither the raw number nor
  // a capped one tells the user anything. Drop the ring and say it plainly.
  if (pace.status === 'overflow') {
    return (
      <div className="mt-auto rounded-2xl border border-terracotta/30 bg-terracotta-soft p-4">
        <p className="text-[13.5px] font-bold text-expense">{t('pace_overflow')}</p>
        <p className="mt-1 text-[11.5px] font-semibold text-text-muted">
          {t('pace_overflow_note', { spent: fmt(pace.spent), income: fmt(pace.income) })}
        </p>
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
 * "Cuánto gastaste" — the month's OWN spending, split by where it stands.
 *
 *     Gastaste  =  Ya se pagó  +  Por pagar
 *
 * Every amount is the user's SHARE of a shared movement, never the full ticket:
 * the card reads on one lens and one unit. The cash lens — pesos moving through
 * the accounts, full amounts — belongs to the balance card above ("Se fue").
 *
 * "Ya se pagó" is impersonal on purpose: a shared expense the partner paid IS
 * settled with the merchant, just not by you. The breakdown says who, so the
 * label does not have to lie.
 */
export const SpentCard = ({ otherName }: Props) => {
  const t = useTranslations('dashboard.spent')
  const { selected } = useDashboardMonth()
  const [expanded, setExpanded] = useState(false)
  const panelBase = useId()

  const spendingQuery = useQuery({
    queryKey: ['dashboard', 'month-spending', selected.year, selected.month],
    queryFn: () => getMonthSpending(createClient(), monthKey(selected.year, selected.month)),
    staleTime: 60_000,
  })
  const balanceQuery = useQuery({
    queryKey: ['dashboard', 'balance-series', selected.year, selected.month],
    queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month),
    staleTime: 60_000,
  })

  const empty: MonthSpendingSplit = {
    gastaste: 0,
    yaSePago: { total: 0, pusisteVos: 0, pusoElOtro: 0 },
    porPagar: { total: 0, enTusTarjetas: 0, leDebesAlOtro: 0 },
  }
  const ars = spendingQuery.data?.ARS ?? empty
  const usd = spendingQuery.data?.USD ?? empty
  const pace = deriveSpendingPace(ars.gastaste, balanceQuery.data?.ARS.totalIncome ?? 0)

  const isEmpty = ars.gastaste === 0 && usd.gastaste === 0
  // One decision for the three tiles (the USD line), so they stay level.
  const tilesHaveUsd = usd.gastaste !== 0

  // The breakdown only exists when the month actually has a shared side: with no
  // partner involved every peso is yours and the two rows would say so twice.
  const hasShared =
    otherName != null && (ars.yaSePago.pusoElOtro !== 0 || ars.porPagar.leDebesAlOtro !== 0)

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
            <div className="grid grid-cols-3 items-stretch gap-2.5">
              <Tile
                tone="spent"
                icon={<ShoppingBag size={18} strokeWidth={2} aria-hidden />}
                label={t('gastaste')}
                ars={ars.gastaste}
                usd={usd.gastaste}
                showUsd={tilesHaveUsd}
                breakdown={null}
                panelId={`${panelBase}-spent`}
                expanded={expanded}
              />
              <Tile
                tone="paid"
                icon={<CreditCard size={18} strokeWidth={2} aria-hidden />}
                label={t('paid')}
                ars={ars.yaSePago.total}
                usd={usd.yaSePago.total}
                showUsd={tilesHaveUsd}
                breakdown={
                  hasShared
                    ? [
                        { label: t('paid_by_you'), amount: ars.yaSePago.pusisteVos },
                        {
                          label: t('paid_by_other', { name: otherName }),
                          amount: ars.yaSePago.pusoElOtro,
                        },
                      ]
                    : null
                }
                panelId={`${panelBase}-paid`}
                expanded={expanded}
              />
              <Tile
                tone="pending"
                icon={<Clock size={18} strokeWidth={2} aria-hidden />}
                label={t('pending')}
                ars={ars.porPagar.total}
                usd={usd.porPagar.total}
                showUsd={tilesHaveUsd}
                breakdown={
                  hasShared
                    ? [
                        { label: t('pending_on_cards'), amount: ars.porPagar.enTusTarjetas },
                        {
                          label: t('pending_owed_other', { name: otherName }),
                          amount: ars.porPagar.leDebesAlOtro,
                        },
                      ]
                    : null
                }
                panelId={`${panelBase}-pending`}
                expanded={expanded}
              />
            </div>

            {/* One toggle for the card, not one per tile: the three amounts are
                read together, and three independent chevrons would let the user
                open a partial view of a single split. */}
            {hasShared && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls={`${panelBase}-paid ${panelBase}-pending`}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold text-text-muted transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {expanded ? t('breakdown_hide') : t('breakdown_show')}
                <ChevronDown
                  aria-hidden
                  size={15}
                  className={cn('transition-transform duration-[180ms] ease-out', expanded && 'rotate-180')}
                />
              </button>
            )}

            <PaceStrip pace={pace} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
