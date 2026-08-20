import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Clock, CreditCard, ShoppingBag } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import {
  deriveSpendingPace,
  type MonthSpendingSplit,
  type SpendingPace,
} from '@grana/dashboard'
import { formatARS } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { useMonthBalanceSeries, useMonthSpending } from '../../lib/dashboard/queries'
import { getHousehold } from '../../lib/shared/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { useEyeMask } from './EyeMaskContext'
import { SpentTile } from './SpentTile'
import { SpendingSkeleton } from './SpendingSkeleton'

// Native mirror of the web `spent-card.tsx`: the month's OWN spending split by
// where it stands (`Gastaste = Ya se pagó + Por pagar`), with the shared
// breakdown behind one toggle for the whole card.
//
// RN has no conic-gradient, so the pace ring is a bordered circle plus the
// percentage — the number is what carries the meaning.

/** One decimal only when it says something: "1,5" but "10", not "10,0". */
const fmtTimes = (times: number) =>
  times.toLocaleString('es-AR', { maximumFractionDigits: 1 })

const PaceStrip = ({ pace }: { pace: SpendingPace }) => {
  const t = useT()
  const { masked } = useEyeMask()
  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, false))

  if (pace.status === 'indeterminate') {
    return (
      <View className="mt-3 rounded-2xl border border-border bg-page p-3.5">
        <Text className="text-[12.5px] font-bold text-text-muted">
          {t('dashboard.spent.pace_unknown')}
        </Text>
        <Text className="mt-1 text-[11px] font-semibold text-text-soft">
          {t('dashboard.spent.pace_unknown_note')}
        </Text>
      </View>
    )
  }

  // Ratio off the scale: there IS income, just cents of it, so this is not
  // "indeterminate" — but the number stopped being a reading.
  if (pace.status === 'overflow') {
    return (
      <View className="mt-3 rounded-2xl border border-border bg-page p-3.5">
        <Text className="text-[12.5px] font-bold text-terracotta">
          {t('dashboard.spent.pace_overflow')}
        </Text>
        <Text className="mt-1 text-[11px] font-semibold text-text-muted">
          {t('dashboard.spent.pace_overflow_note', {
            spent: fmt(pace.spent),
            income: fmt(pace.income),
          })}
        </Text>
      </View>
    )
  }

  const over = pace.status === 'over'
  const fill = over ? colors.terracotta : colors.positive

  return (
    <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-border bg-page p-3.5">
      <View
        className="size-[46px] items-center justify-center rounded-full border-4"
        style={{ borderColor: fill }}
      >
        <Text
          className={`text-[11.5px] font-extrabold ${over ? 'text-terracotta' : 'text-positive'}`}
        >
          {over ? `${fmtTimes(pace.times)}×` : `${pace.pct}%`}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-[12.5px] font-bold text-text-muted">
          {over
            ? t('dashboard.spent.pace_over', { times: fmtTimes(pace.times) })
            : t('dashboard.spent.pace', { pct: `${pace.pct}%` })}
        </Text>
        <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-soft">
          <View
            className="h-full rounded-full"
            style={{ width: `${pace.fillPct}%`, backgroundColor: fill }}
          />
        </View>
        <Text className="mt-1.5 text-[10.5px] font-semibold text-text-soft">
          {t('dashboard.spent.pace_foot', { spent: fmt(pace.spent), income: fmt(pace.income) })}
        </Text>
      </View>
    </View>
  )
}

const EMPTY: MonthSpendingSplit = {
  gastaste: 0,
  yaSePago: { total: 0, pusisteVos: 0, pusoElOtro: 0 },
  porPagar: { total: 0, enTusTarjetas: 0, leDebesAlOtro: 0 },
}

export const SpentCard = () => {
  const t = useT()
  const router = useRouter()
  const { selected } = useDashboardMonth()
  // Only one tile turned at a time.
  const [flipped, setFlipped] = useState<'paid' | 'pending' | null>(null)

  const spendingQuery = useMonthSpending(selected.year, selected.month)
  const balanceQuery = useMonthBalanceSeries(selected.year, selected.month)

  // Partner's first name for the breakdown copy. Tolerant: without it the card
  // simply renders no breakdown.
  const householdQuery = useQuery({
    queryKey: ['dashboard', 'household-other-name'] as const,
    queryFn: async () => {
      const household = await getHousehold()
      if (!household || household.members.length < 2) return null
      return household.members[1]!.fullName.trim().split(/\s+/)[0] ?? null
    },
    retry: false,
  })
  const otherName = householdQuery.data ?? null

  const ars = spendingQuery.data?.ARS ?? EMPTY
  const usd = spendingQuery.data?.USD ?? EMPTY
  const pace = deriveSpendingPace(ars.gastaste, balanceQuery.data?.ARS.totalIncome ?? 0)

  const isLoading = spendingQuery.isPending || balanceQuery.isPending
  const tilesHaveUsd = usd.gastaste !== 0
  const hasShared =
    otherName != null && (ars.yaSePago.pusoElOtro !== 0 || ars.porPagar.leDebesAlOtro !== 0)

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] font-extrabold text-text">{t('dashboard.spent.title')}</Text>
        <Pressable
          onPress={() => router.push('/transactions')}
          accessibilityRole="button"
          hitSlop={12}
        >
          <Text className="text-[12.5px] font-bold text-positive">
            {t('dashboard.spent.view_detail')} ›
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <SpendingSkeleton />
      ) : ars.gastaste === 0 && usd.gastaste === 0 ? (
        <Text className="py-6 text-center text-[12.5px] font-semibold text-text-soft">
          {t('dashboard.spent.empty')}
        </Text>
      ) : (
        <>
          <View className="mt-3 flex-row gap-2">
            <SpentTile
              tone="spent"
              icon={<ShoppingBag size={16} color={colors.emeraldDeep} strokeWidth={2} />}
              label={t('dashboard.spent.gastaste')}
              ars={ars.gastaste}
              usd={usd.gastaste}
              showUsd={tilesHaveUsd}
              caption={{
                lead: t('dashboard.spent.gastaste_sub_1'),
                emphasis: t('dashboard.spent.gastaste_sub_2'),
              }}
              flipped={false}
              onToggle={() => {}}
            />
            <SpentTile
              tone="paid"
              icon={<CreditCard size={16} color={colors.slate} strokeWidth={2} />}
              label={t('dashboard.spent.paid')}
              ars={ars.yaSePago.total}
              usd={usd.yaSePago.total}
              showUsd={tilesHaveUsd}
              caption={{
                lead: t('dashboard.spent.paid_sub_1'),
                emphasis: t('dashboard.spent.paid_sub_2'),
              }}
              breakdown={
                hasShared
                  ? {
                      title: t('dashboard.spent.paid'),
                      openLabel: t('dashboard.spent.open_breakdown'),
                      backLabel: t('dashboard.spent.back'),
                      rows: [
                        {
                          label: t('dashboard.spent.paid_by_you'),
                          amount: ars.yaSePago.pusisteVos,
                        },
                        {
                          label: t('dashboard.spent.paid_by_other', { name: otherName }),
                          amount: ars.yaSePago.pusoElOtro,
                        },
                      ],
                    }
                  : undefined
              }
              flipped={flipped === 'paid'}
              onToggle={() => setFlipped((f) => (f === 'paid' ? null : 'paid'))}
            />
            <SpentTile
              tone="pending"
              icon={<Clock size={16} color={colors.warningDeep} strokeWidth={2} />}
              label={t('dashboard.spent.pending')}
              ars={ars.porPagar.total}
              usd={usd.porPagar.total}
              showUsd={tilesHaveUsd}
              caption={{
                lead: t('dashboard.spent.pending_sub_1'),
                emphasis: t('dashboard.spent.pending_sub_2'),
              }}
              breakdown={
                hasShared
                  ? {
                      title: t('dashboard.spent.pending'),
                      openLabel: t('dashboard.spent.open_breakdown'),
                      backLabel: t('dashboard.spent.back'),
                      rows: [
                        {
                          label: t('dashboard.spent.pending_on_cards'),
                          amount: ars.porPagar.enTusTarjetas,
                        },
                        {
                          label: t('dashboard.spent.pending_owed_other', { name: otherName }),
                          amount: ars.porPagar.leDebesAlOtro,
                        },
                      ],
                    }
                  : undefined
              }
              flipped={flipped === 'pending'}
              onToggle={() => setFlipped((f) => (f === 'pending' ? null : 'pending'))}
            />
          </View>

          <PaceStrip pace={pace} />
        </>
      )}
    </View>
  )
}
