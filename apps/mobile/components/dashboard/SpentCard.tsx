import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react-native'
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
import { MaskedAmount } from './MaskedAmount'
import { SpendingSkeleton } from './SpendingSkeleton'

// Native mirror of the web `spent-card.tsx`: the month's OWN spending split by
// where it stands (`Gastaste = Ya se pagó + Por pagar`), with the shared
// breakdown behind one toggle for the whole card.
//
// RN has no conic-gradient, so the pace ring is a bordered circle plus the
// percentage — the number is what carries the meaning.

type TileTone = 'spent' | 'paid' | 'pending'

const TONE: Record<TileTone, { amount: string; rule: string }> = {
  spent: { amount: 'text-positive', rule: colors.positive },
  paid: { amount: 'text-slate', rule: colors.slate },
  pending: { amount: 'text-warning-deep', rule: colors.warningDeep },
}

const Tile = ({
  tone,
  label,
  ars,
  usd,
  showUsd,
  breakdown,
  expanded,
}: {
  tone: TileTone
  label: string
  ars: number
  usd: number
  showUsd: boolean
  breakdown: { label: string; amount: number }[] | null
  expanded: boolean
}) => (
  <View className="flex-1 overflow-hidden rounded-2xl border border-border">
    <View className="flex-1 items-center px-2 pb-2 pt-2.5">
      <Text numberOfLines={2} className="text-center text-[11px] font-extrabold text-text-muted">
        {label}
      </Text>
      <MaskedAmount
        amount={ars}
        currency="ARS"
        className={`mt-1 text-[16px] font-extrabold ${TONE[tone].amount}`}
      />
      {showUsd && (
        <MaskedAmount
          amount={usd}
          currency="USD"
          showCentsOverride
          className="mt-0.5 text-[10px] font-semibold text-text-soft"
        />
      )}
    </View>

    {breakdown && expanded && (
      <View className="gap-1 border-t border-border-soft px-2 pb-2 pt-2">
        {breakdown.map((row) => (
          <View key={row.label}>
            <Text numberOfLines={1} className="text-[9.5px] font-semibold text-text-soft">
              {row.label}
            </Text>
            <MaskedAmount
              amount={row.amount}
              currency="ARS"
              className="text-[10.5px] font-extrabold text-text"
            />
          </View>
        ))}
      </View>
    )}

    <View className="h-1 w-full" style={{ backgroundColor: TONE[tone].rule }} />
  </View>
)

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
          {pace.pct}%
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-[12.5px] font-bold text-text-muted">
          {t(over ? 'dashboard.spent.pace_over' : 'dashboard.spent.pace', {
            pct: `${pace.pct}%`,
          })}
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
  const [expanded, setExpanded] = useState(false)

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
            <Tile
              tone="spent"
              label={t('dashboard.spent.gastaste')}
              ars={ars.gastaste}
              usd={usd.gastaste}
              showUsd={tilesHaveUsd}
              breakdown={null}
              expanded={expanded}
            />
            <Tile
              tone="paid"
              label={t('dashboard.spent.paid')}
              ars={ars.yaSePago.total}
              usd={usd.yaSePago.total}
              showUsd={tilesHaveUsd}
              breakdown={
                hasShared
                  ? [
                      { label: t('dashboard.spent.paid_by_you'), amount: ars.yaSePago.pusisteVos },
                      {
                        label: t('dashboard.spent.paid_by_other', { name: otherName }),
                        amount: ars.yaSePago.pusoElOtro,
                      },
                    ]
                  : null
              }
              expanded={expanded}
            />
            <Tile
              tone="pending"
              label={t('dashboard.spent.pending')}
              ars={ars.porPagar.total}
              usd={usd.porPagar.total}
              showUsd={tilesHaveUsd}
              breakdown={
                hasShared
                  ? [
                      {
                        label: t('dashboard.spent.pending_on_cards'),
                        amount: ars.porPagar.enTusTarjetas,
                      },
                      {
                        label: t('dashboard.spent.pending_owed_other', { name: otherName }),
                        amount: ars.porPagar.leDebesAlOtro,
                      },
                    ]
                  : null
              }
              expanded={expanded}
            />
          </View>

          {hasShared && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ minHeight: 44 }}
              className="mt-2 flex-row items-center justify-center gap-1.5"
            >
              <Text className="text-[12px] font-bold text-text-muted">
                {expanded
                  ? t('dashboard.spent.breakdown_hide')
                  : t('dashboard.spent.breakdown_show')}
              </Text>
              <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={14} color={colors.textMuted} />
              </View>
            </Pressable>
          )}

          <PaceStrip pace={pace} />
        </>
      )}
    </View>
  )
}
