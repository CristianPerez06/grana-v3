import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  densestAmountDensity,
  derivePlacement,
  deriveBalanceCardView,
  deriveMonthSummary,
  type AmountDensity,
  type CurrencyPlacement,
  type SavingsRow,
} from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { accountColors, colors } from '../../lib/colors'
import { useDashboardHero, useMonthBalanceSeries } from '../../lib/dashboard/queries'
import { useAvailableTotals, useReservedFlow } from '../../lib/savings/queries'
import { SavingsDrawer } from '../savings/SavingsDrawer'
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

// The currency is a LEFT GUTTER, not a row of its own — a whole line for the
// word "ARS" is a line not spent on data — and the accounts stack to its right,
// each with its percentage pushed hard right so the percentages line up in a
// column, which is what gets compared. Mirrors web's stacked composition.
const PlacementColumn = ({
  placement,
  currency,
}: {
  placement: CurrencyPlacement
  currency: string
}) => (
  <View className="flex-row gap-3">
    <Text className="w-8 text-[10.5px] font-extrabold uppercase tracking-widest text-white/50">
      {currency}
    </Text>
    <View className="min-w-0 flex-1 gap-2">
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
  </View>
)

/**
 * Same shrink rule as web (shared thresholds), on the native scale. The steps
 * are roomier than they were: with one amount per row instead of three across,
 * each one has the card's full width to sit in.
 */
const SUMMARY_SIZE: Record<AmountDensity, string> = {
  normal: 'text-[19px]',
  tight: 'text-[17px]',
  tighter: 'text-[15px]',
  tightest: 'text-[13px]',
}

const Flow = ({
  label,
  dotColor,
  amountClassName,
  ars,
  usd,
  showUsd,
  signPrefix,
  density,
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
  /** Type step, decided once for the three (see the card). */
  density: AmountDensity
}) => (
  // ONE ROW per amount — label left, amount right — not three columns. Three
  // amounts across a phone-width card leave ~100px each, and `fitOneLine` was
  // shrinking eight-figure amounts down to something nobody can read. A full row
  // each fits them at their real size. Web does the same below its `sm` break.
  <View className="flex-row items-center justify-between gap-3">
    <View className="flex-row items-center gap-1.5">
      <View className="size-[7px] rounded-full" style={{ backgroundColor: dotColor }} />
      <Text className="text-[10.5px] font-bold text-text-muted">{label}</Text>
    </View>
    <View className="min-w-0 flex-1 items-end">
      <MaskedAmount
        amount={ars}
        currency="ARS"
        signPrefix={signPrefix}
        fitOneLine
        className={`font-extrabold ${SUMMARY_SIZE[density]} ${amountClassName}`}
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
  </View>
)

/**
 * The savings row — BELOW A RULE, never a fourth member of the strip.
 *
 * The strip of three is liquidity; saving is a decision about money that stayed
 * where it was. On a phone the row is deliberately COMPACT — one line, label
 * left, amount right — because the card is already tall and this is a readout
 * with an action, not a fourth amount competing for attention.
 *
 * The sign comes from the STATE, never from the number: a raw signed net would
 * eventually print "Guardaste este mes +$50.000".
 */
const SavingsLine = ({ row, onPress }: { row: SavingsRow; onPress: () => void }) => {
  const t = useT()
  const isEmpty = row.state === 'empty'
  const sign = row.state === 'saved' ? '−' : row.state === 'released' ? '+' : undefined

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mt-2.5 flex-row items-center justify-between border-t border-border-soft pt-2.5"
    >
      <View className="flex-row items-center gap-2">
        <View
          className="h-[7px] w-[7px] rounded-full"
          style={{ backgroundColor: isEmpty ? colors.border : colors.positive }}
        />
        <Text
          className={`text-[13px] font-bold ${isEmpty ? 'text-text-soft' : 'text-text-muted'}`}
        >
          {t(`dashboard.savings.${row.state}`)}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        {!isEmpty && (
          <MaskedAmount
            amount={row.amount}
            currency="ARS"
            signPrefix={sign}
            className="text-[15px] font-extrabold text-positive"
          />
        )}
        <Text className="text-[14px] font-bold text-text-soft">›</Text>
      </View>
    </Pressable>
  )
}

export const BalanceCard = ({ todayISO }: { todayISO: string }) => {
  const t = useT()
  const showCents = useShowCents()
  const router = useRouter()
  const { selected, current, isCurrent } = useDashboardMonth()

  const [savingsOpen, setSavingsOpen] = useState(false)
  const cutISO = balanceCutISO(selected, current, todayISO)
  const heroQuery = useDashboardHero(cutISO)
  const monthQuery = useMonthBalanceSeries(selected.year, selected.month)
  // Only for the current month: the reserve is netted exactly where the card says
  // "disponible", and a past month's label already says something else.
  const availableQuery = useAvailableTotals(cutISO, isCurrent)
  const flowQuery = useReservedFlow(selected.year, selected.month, todayISO, isCurrent)

  const hero = heroQuery.data
  const placement = hero ? derivePlacement(hero.accounts) : null
  const summary = monthQuery.data ? deriveMonthSummary(monthQuery.data) : null

  // Same decision function as web: which number the dark zone shows, which state
  // the savings row is in, and what "Venía" derives from.
  const { displayed, savings, venia } = deriveBalanceCardView({
    isCurrent,
    accounts: hero ? { ARS: hero.ars, USD: hero.usd } : null,
    available: isCurrent ? (availableQuery.data ?? null) : null,
    reservedNet: flowQuery.data ?? { ARS: 0, USD: 0 },
    summary,
  })
  const hasUsd = hero != null && (placement!.USD.rows.length > 0 || displayed.USD !== 0)

  const summaryHasUsd =
    (venia?.USD ?? 0) !== 0 ||
    (summary?.USD.entro ?? 0) !== 0 ||
    (summary?.USD.seFue ?? 0) !== 0
  // One type step for the three amounts, so they never shrink at different
  // points — same rule as the tiles of "Cuánto gastaste".
  const summaryDensity = densestAmountDensity(
    [venia?.ARS ?? 0, summary?.ARS.entro ?? 0, summary?.ARS.seFue ?? 0],
    showCents,
  )
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
                amount={displayed.ARS}
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
                    amount={displayed.USD}
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
          // Currencies STACKED, not side by side: at phone width two columns
          // left ~145px each and the account names truncated to a letter or two.
          <View className="mt-3 gap-3">
            <PlacementColumn placement={placement.ARS} currency="ARS" />
            {hasUsd && (
              <View className="border-t border-white/10 pt-3">
                <PlacementColumn placement={placement.USD} currency="USD" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Light zone — "Resumen del mes"; follows the month selector. */}
      <View className="px-4 pb-4 pt-3">
        <Text className="text-[15px] font-extrabold text-text">
          {t('dashboard.month.summary_title')}
        </Text>
        <View className="mt-3 gap-2.5">
          <Flow
            label={t('dashboard.month.carried_in')}
            dotColor={colors.textSoft}
            amountClassName="text-text"
            ars={venia?.ARS ?? 0}
            usd={venia?.USD ?? 0}
            showUsd={summaryHasUsd}
            density={summaryDensity}
          />
          <Flow
            label={t('dashboard.month.came_in')}
            dotColor={colors.positive}
            amountClassName="text-positive"
            ars={summary?.ARS.entro ?? 0}
            usd={summary?.USD.entro ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="+"
            density={summaryDensity}
          />
          <Flow
            label={t('dashboard.month.went_out')}
            dotColor={colors.slate}
            amountClassName="text-slate"
            ars={summary?.ARS.seFue ?? 0}
            usd={summary?.USD.seFue ?? 0}
            showUsd={summaryHasUsd}
            signPrefix="−"
            density={summaryDensity}
          />
        </View>

        {savings.ARS && (
          <SavingsLine row={savings.ARS} onPress={() => setSavingsOpen(true)} />
        )}
      </View>

      {/* With nothing set aside there is no detail worth reading, so the row goes
          straight to the act instead of through an empty screen. */}
      <SavingsDrawer
        visible={savingsOpen}
        onClose={() => setSavingsOpen(false)}
        initialMode={
          savings.ARS?.state === 'empty' ? { mode: 'save', currency: 'ARS' } : undefined
        }
      />
    </View>
  )
}
