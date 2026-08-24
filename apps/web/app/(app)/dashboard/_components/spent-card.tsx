'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Clock, CreditCard, ShoppingBag } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import {
  densestAmountDensity,
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
import { SpentCardBodySkeleton } from './spent-card-body-skeleton'
import { SpentTile } from './spent-tile'

type Props = {
  /** Household partner's first name, or null when there is no Compartido. */
  otherName: string | null
}

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

/** One decimal only when it says something: "1,5" but "10", not "10,0". */
const fmtTimes = (times: number) =>
  times.toLocaleString('es-AR', { maximumFractionDigits: 1 })

const PaceStrip = ({ pace }: { pace: SpendingPace }) => {
  const t = useTranslations('dashboard.spent')
  const { masked } = useEyeMask()
  const showCents = useShowCents()
  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, showCents))

  // No income yet → the ratio has no denominator. Saying "0%" would read as
  // "you spent nothing", so the strip explains itself instead of drawing a ring.
  if (pace.status === 'indeterminate') {
    return (
      <div className="rounded-2xl border border-border bg-surface-sunken p-4">
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
      <div className="rounded-2xl border border-terracotta/30 bg-terracotta-soft p-4">
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
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-sunken p-4">
      <div
        aria-hidden
        className="relative size-[54px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${ringColor} 0 ${pace.fillPct}%, var(--border-soft) ${pace.fillPct}% 100%)`,
        }}
      >
        <span className="absolute inset-[8px] flex items-center justify-center rounded-full bg-surface-sunken text-[13px] font-extrabold">
          {/* Past 100% the ring shows the MULTIPLE: "1020%" does not fit the
              hole and does not read either. */}
          <span className={over ? 'text-expense' : 'text-emerald-deep'}>
            {over ? `${fmtTimes(pace.times)}×` : `${pace.pct}%`}
          </span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-text-muted">
          {over
            ? t('pace_over', { times: fmtTimes(pace.times) })
            : t('pace', { pct: `${pace.pct}%` })}
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
  const showCents = useShowCents()
  const { selected } = useDashboardMonth()
  // Only one tile turned at a time: two open backs would compete for the same
  // reading and the card would stop looking like one object.
  const [flipped, setFlipped] = useState<'paid' | 'pending' | null>(null)

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

  // Loading is NOT empty: while the read has not resolved the amounts are 0
  // because there is no data, and `isEmpty` used to claim "Sin gastos este mes."
  // off the back of that. The empty state is decided only once the read resolved
  // and came back zero. It hit on every month change too: the query re-keys.
  const isLoading = spendingQuery.isPending || balanceQuery.isPending
  const isEmpty = !isLoading && ars.gastaste === 0 && usd.gastaste === 0
  // One decision for the three tiles (the USD line), so they stay level.
  const tilesHaveUsd = usd.gastaste !== 0
  // Same rule for the type step: the three amounts share the tightest one any of
  // them needs. Sized per tile, they shrank at different points, which knocked
  // the vertically centred tiles out of line and made "Gastaste" render smaller
  // than the "Por pagar" derived from it.
  const tilesDensity = densestAmountDensity(
    [ars.gastaste, ars.yaSePago.total, ars.porPagar.total],
    showCents,
  )

  // The breakdown only exists when the month actually has a shared side: with no
  // partner involved every peso is yours and the two rows would say so twice.
  const hasShared =
    otherName != null && (ars.yaSePago.pusoElOtro !== 0 || ars.porPagar.leDebesAlOtro !== 0)

  return (
    <Card className="flex flex-col">
      {/* One row at every width: the link belongs beside the title, not stacked
          under it. The title shrinks; the link never wraps.

          Horizontal padding drops to 16px below `sm`: `p-6` is 24px a side, and
          on a 390px screen that plus the page gutter left each tile ~85px for an
          amount that can need ~92px — the card was spending its scarcest
          resource on air. Header and content step down together so the title
          stays flush with the tiles. */}
      <CardHeader className="flex-row items-center justify-between gap-3 px-4 sm:px-6">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-text">
          {t('title')}
        </h2>
        <Link
          href="/transactions"
          className="shrink-0 whitespace-nowrap rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('view_detail')} ›
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 sm:px-6">
        {isLoading ? (
          <SpentCardBodySkeleton />
        ) : isEmpty ? (
          <p className="py-6 text-center text-[13.5px] font-semibold text-text-soft">
            {t('empty')}
          </p>
        ) : (
          <>
            <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-[11px]">
              <SpentTile
                tone="spent"
                icon={<ShoppingBag size={18} strokeWidth={2} aria-hidden />}
                label={t('gastaste')}
                ars={ars.gastaste}
                usd={usd.gastaste}
                showUsd={tilesHaveUsd}
                caption={{ lead: t('gastaste_sub_1'), emphasis: t('gastaste_sub_2') }}
                flipped={false}
                onToggle={() => {}}
                density={tilesDensity}
              />
              <SpentTile
                tone="paid"
                icon={<CreditCard size={18} strokeWidth={2} aria-hidden />}
                label={t('paid')}
                ars={ars.yaSePago.total}
                usd={usd.yaSePago.total}
                showUsd={tilesHaveUsd}
                caption={{ lead: t('paid_sub_1'), emphasis: t('paid_sub_2') }}
                breakdown={
                  hasShared
                    ? {
                        title: t('paid'),
                        openLabel: t('open_breakdown'),
                        backLabel: t('back'),
                        rows: [
                          { label: t('paid_by_you'), amount: ars.yaSePago.pusisteVos },
                          {
                            label: t('paid_by_other', { name: otherName }),
                            amount: ars.yaSePago.pusoElOtro,
                          },
                        ],
                      }
                    : undefined
                }
                density={tilesDensity}
                flipped={flipped === 'paid'}
                onToggle={() => setFlipped((f) => (f === 'paid' ? null : 'paid'))}
              />
              <SpentTile
                tone="pending"
                icon={<Clock size={18} strokeWidth={2} aria-hidden />}
                label={t('pending')}
                ars={ars.porPagar.total}
                usd={usd.porPagar.total}
                showUsd={tilesHaveUsd}
                caption={{ lead: t('pending_sub_1'), emphasis: t('pending_sub_2') }}
                breakdown={
                  hasShared
                    ? {
                        title: t('pending'),
                        openLabel: t('open_breakdown'),
                        backLabel: t('back'),
                        rows: [
                          { label: t('pending_on_cards'), amount: ars.porPagar.enTusTarjetas },
                          {
                            label: t('pending_owed_other', { name: otherName }),
                            amount: ars.porPagar.leDebesAlOtro,
                          },
                        ],
                      }
                    : undefined
                }
                density={tilesDensity}
                flipped={flipped === 'pending'}
                onToggle={() => setFlipped((f) => (f === 'pending' ? null : 'pending'))}
              />
            </div>

            <PaceStrip pace={pace} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
