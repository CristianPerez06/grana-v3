import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  amountDensity,
  derivePlacement,
  deriveMonthOpening,
  deriveMonthSummary,
  type AmountDensity,
  type CurrencyPlacement,
} from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { accountColors, colors } from '../../lib/colors'
import { useDashboardHero, useMonthBalanceSeries } from '../../lib/dashboard/queries'
import { useShowCents } from '../../lib/preferences-context'
import { useDashboardMonth } from './DashboardMonthContext'
import { HeroSkeleton } from './HeroSkeleton'
import { MaskedAmount } from './MaskedAmount'
import { MaskedAmountDisplay } from './MaskedAmountDisplay'

// Native mirror of the web `balance-card.tsx`. One card, two zones: the dark
// one with the balance, the USD line and "Dónde está" folded in; the light one
// with "Resumen del mes".
//
// The whole card follows the month selector: the balance is cut at the selected
// month's last day, so the three amounts below close against it
// (`Venía + Entró − Se fue === el saldo de arriba`).
//
// Bimoneda: each currency is ranked on its own and never converted, and a
// currency holding nothing renders nothing at all instead of a column of zeros.
const SWAP_MIN_HEIGHT = 84

/** Last day of the month, or today when that month is the current one. */
const balanceCutISO = (
  selected: { year: number; month: number },
  current: { year: number; month: number },
  today: string,
): string => {
  const isCurrentOrLater =
    selected.year > current.year ||
    (selected.year === current.year && selected.month >= current.month)
  if (isCurrentOrLater) return today

  const lastDay = new Date(selected.year, selected.month, 0).getDate()
  return `${selected.year}-${String(selected.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

const rowColor = (colorKey: string | null, override: string | null): string =>
  colorKey && colorKey in accountColors
    ? accountColors[colorKey as keyof typeof accountColors]
    : (override ?? colors.slate)

const PlacementColumn = ({ placement }: { placement: CurrencyPlacement }) => (
  <View className="flex-1 gap-2">
    {placement.rows.map((row) => (
      <View key={row.id} className="flex-row items-center gap-2">
        <View
          className="size-[9px] rounded-[2px]"
          style={{ backgroundColor: rowColor(row.avatar.colorKey, row.avatar.colorOverride) }}
        />
        <Text numberOfLines={1} className="flex-1 text-[12.5px] font-semibold text-white/65">
          {row.label}
        </Text>
        <Text className="text-[13px] font-extrabold text-white">{row.pct}%</Text>
      </View>
    ))}
  </View>
)

/** Same shrink rule as web (shared thresholds), on the native scale. */
const SUMMARY_SIZE: Record<AmountDensity, string> = {
  normal: 'text-[15px]',
  tight: 'text-[13.5px]',
  tighter: 'text-[12px]',
  tightest: 'text-[10.5px]',
}

const Flow = ({
  label,
  dotColor,
  amountClassName,
  ars,
  usd,
  showUsd,
  signPrefix,
}: {
  label: string
  dotColor: string
  amountClassName: string
  ars: number
  usd: number
  /**
   * Decided ONCE for the whole block, not per amount: three peer amounts have
   * to line up, and hiding the USD line only where it is zero left one column
   * taller than its neighbours.
   */
  showUsd: boolean
  /** "+" / "−" on the two FLOWS; the carried-in balance shows only its own. */
  signPrefix?: string
}) => {
  const showCents = useShowCents()

  return (
    // Left-aligned inside its column (mirrors web): the first column starts on
    // the card's title axis and a growing amount extends into free space instead
    // of toward its neighbour.
    <View className="flex-1 items-start">
      <View className="flex-row items-center gap-1.5">
        <View className="size-[7px] rounded-full" style={{ backgroundColor: dotColor }} />
        <Text className="text-[10.5px] font-bold text-text-muted">{label}</Text>
      </View>
      <MaskedAmount
        amount={ars}
        currency="ARS"
        signPrefix={signPrefix}
        fitOneLine
        className={`mt-1.5 font-extrabold ${SUMMARY_SIZE[amountDensity(ars, showCents)]} ${amountClassName}`}
      />
      {showUsd && (
        <MaskedAmount
          amount={usd}
          currency="USD"
          showCentsOverride
          signPrefix={signPrefix}
          fitOneLine
          className="mt-0.5 text-[9.5px] font-semibold text-text-soft"
        />
      )}
    </View>
  )
}

export const BalanceCard = ({ todayISO }: { todayISO: string }) => {
  const t = useT()
  const router = useRouter()
  const { selected, current, isCurrent } = useDashboardMonth()

  const heroQuery = useDashboardHero(balanceCutISO(selected, current, todayISO))
  const monthQuery = useMonthBalanceSeries(selected.year, selected.month)

  const hero = heroQuery.data
  const placement = hero ? derivePlacement(hero.accounts) : null
  const hasUsd = hero != null && (placement!.USD.rows.length > 0 || hero.usd !== 0)

  const summary = monthQuery.data ? deriveMonthSummary(monthQuery.data) : null
  // Derived, not read: one less round-trip and the identity holds by construction.
  const venia =
    hero && summary
      ? {
          ARS: deriveMonthOpening(hero.ars, summary.ARS),
          USD: deriveMonthOpening(hero.usd, summary.USD),
        }
      : null
  const summaryHasUsd =
    (venia?.USD ?? 0) !== 0 ||
    (summary?.USD.entro ?? 0) !== 0 ||
    (summary?.USD.seFue ?? 0) !== 0
  const monthLabel = new Date(selected.year, selected.month - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Dark zone — today's balance; does NOT follow the month selector. */}
      <View className="bg-navy px-[18px] pb-[17px] pt-5">
        <Text className="text-center text-[10.5px] font-extrabold uppercase tracking-widest text-white/50">
          {isCurrent
            ? t('dashboard.hero.total_label')
            : t('dashboard.hero.balance_as_of', { month: monthLabel })}
        </Text>

        <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
          {hero ? (
            <>
              <MaskedAmountDisplay
                amount={hero.ars}
                currency="ARS"
                className="text-center text-[34px] font-extrabold text-white"
                decimalClassName="text-[15px] text-white/55"
              />
              {hasUsd && (
                <View className="mt-3 flex-row items-center justify-center gap-2.5">
                  <View className="rounded-full bg-emerald-soft px-2.5 py-1">
                    <Text className="text-[11px] font-extrabold text-positive">USD</Text>
                  </View>
                  <MaskedAmount
                    amount={hero.usd}
                    currency="USD"
                    showCentsOverride
                    className="text-[15px] font-bold text-white/90"
                  />
                </View>
              )}
            </>
          ) : (
            <HeroSkeleton />
          )}
        </View>

        {/* "Dónde está" */}
        <View className="mt-4 flex-row items-end justify-between border-t border-white/10 pt-3.5">
          <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/50">
            {t('dashboard.accounts.title')}
          </Text>
          <Pressable
            onPress={() => router.push('/accounts')}
            accessibilityRole="button"
            hitSlop={12}
          >
            <Text className="text-[12.5px] font-bold text-mint">
              {t('dashboard.accounts.view_accounts')} ›
            </Text>
          </Pressable>
        </View>

        {placement && (
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Text className="mb-2 text-[11px] font-extrabold tracking-widest text-white/60">
                ARS
              </Text>
              <PlacementColumn placement={placement.ARS} />
            </View>
            {hasUsd && (
              <View className="flex-1 border-l border-white/10 pl-3">
                <Text className="mb-2 text-[11px] font-extrabold tracking-widest text-white/60">
                  USD
                </Text>
                <PlacementColumn placement={placement.USD} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Light zone — "Resumen del mes"; follows the month selector. */}
      <View className="px-4 pb-4 pt-[15px]">
        <Text className="text-[15px] font-extrabold text-text">
          {t('dashboard.month.summary_title')}
        </Text>
        <View className="mt-3 flex-row gap-3">
          <Flow
            label={t('dashboard.month.carried_in')}
            dotColor={colors.textSoft}
            amountClassName="text-text"
            ars={venia?.ARS ?? 0}
            usd={venia?.USD ?? 0}
            showUsd={summaryHasUsd}
          />
          <Flow
            label={t('dashboard.month.came_in')}
            dotColor={colors.positive}
            amountClassName="text-positive"
            ars={summary?.ARS.entro ?? 0}
            usd={summary?.USD.entro ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="+"
          />
          <Flow
            label={t('dashboard.month.went_out')}
            dotColor={colors.slate}
            amountClassName="text-slate"
            ars={summary?.ARS.seFue ?? 0}
            usd={summary?.USD.seFue ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="−"
          />
        </View>
      </View>
    </View>
  )
}
