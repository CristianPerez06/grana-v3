import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { deriveMonthSpending, deriveSpendingPace, type SpendingPace } from '@grana/dashboard'
import { formatARS } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { useMonthBalanceSeries, useMonthCategoryBreakdown } from '../../lib/dashboard/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { useEyeMask } from './EyeMaskContext'
import { MaskedAmount } from './MaskedAmount'
import { SpendingSkeleton } from './SpendingSkeleton'

// Native mirror of the web `spent-card.tsx`: the month's expense as three named
// amounts (Gastaste = Pagaste + Te queda por pagar) plus the pace strip.
//
// RN has no conic-gradient, so the ring is a plain progress bar plus the big
// percentage — the number is what carries the meaning, and faking an arc with
// SVG for this one strip would not earn its weight.

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
  subLead,
  subEmphasis,
}: {
  tone: TileTone
  label: string
  ars: number
  usd: number
  subLead: string
  subEmphasis: string
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
      {usd !== 0 && (
        <MaskedAmount
          amount={usd}
          currency="USD"
          showCentsOverride
          className="mt-0.5 text-[10px] font-semibold text-text-soft"
        />
      )}
    </View>
    <View className="border-t border-border-soft px-2 pb-2.5 pt-2">
      <Text className="text-center text-[10px] font-bold text-text-soft">{subLead}</Text>
      <Text className="text-center text-[10.5px] font-extrabold text-text">{subEmphasis}</Text>
    </View>
    <View className="h-1 w-full" style={{ backgroundColor: TONE[tone].rule }} />
  </View>
)

const PaceStrip = ({ pace }: { pace: SpendingPace }) => {
  const t = useT()
  const { masked } = useEyeMask()
  const fmt = (n: number) => (masked ? '••••••' : formatARS(n, false))

  // No income yet → the ratio has no denominator. "0%" would read as "you spent
  // nothing", which is the opposite of the truth.
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
          {t(over ? 'dashboard.spent.pace_over' : 'dashboard.spent.pace', { pct: `${pace.pct}%` })}
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

export const SpentCard = () => {
  const t = useT()
  const router = useRouter()
  const { selected } = useDashboardMonth()

  const balanceQuery = useMonthBalanceSeries(selected.year, selected.month)
  const breakdownQuery = useMonthCategoryBreakdown(selected.year, selected.month)

  const accruedOf = (currency: 'ARS' | 'USD') =>
    (breakdownQuery.data?.[currency] ?? []).reduce((sum, slice) => sum + slice.value, 0)

  const isLoading = balanceQuery.isPending || breakdownQuery.isPending
  const ars = deriveMonthSpending(accruedOf('ARS'), balanceQuery.data?.ARS.totalExpense ?? 0)
  const usd = deriveMonthSpending(accruedOf('USD'), balanceQuery.data?.USD.totalExpense ?? 0)
  const pace = deriveSpendingPace(ars.gastaste, balanceQuery.data?.ARS.totalIncome ?? 0)

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
              subLead={t('dashboard.spent.gastaste_sub_1')}
              subEmphasis={t('dashboard.spent.gastaste_sub_2')}
            />
            <Tile
              tone="paid"
              label={t('dashboard.spent.pagaste')}
              ars={ars.pagaste}
              usd={usd.pagaste}
              subLead={t('dashboard.spent.pagaste_sub_1')}
              subEmphasis={t('dashboard.spent.pagaste_sub_2')}
            />
            <Tile
              tone="pending"
              label={t('dashboard.spent.pending')}
              ars={ars.teQuedaPorPagar}
              usd={usd.teQuedaPorPagar}
              subLead={t('dashboard.spent.pending_sub_1')}
              subEmphasis={t('dashboard.spent.pending_sub_2')}
            />
          </View>

          <PaceStrip pace={pace} />
        </>
      )}
    </View>
  )
}
