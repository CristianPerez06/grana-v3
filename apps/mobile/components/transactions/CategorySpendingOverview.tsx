import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { ChevronDown, ChevronLeft } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  DONUT_FALLBACK,
  generateSubTints,
  INCOME_PALETTE,
  netAfterCredits,
  RANKING_VISIBLE,
  type CategoryBreakdown,
  type CategorySlice,
} from '@grana/money-logic'
import { Card } from '../ui/Card'
import { Segmented } from '../ui/Segmented'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'

/** Donut diameter. The web card draws 200px on a wide column; a phone card is
 *  narrower, and the ranking sits UNDER the donut instead of beside it. */
const DONUT_SIZE = 168
/** Same geometry web uses: r=15.915 on a 36×36 box ⇒ circumference ≈ 100, so
 *  `strokeDasharray` maps 1:1 to percentages. */
const DONUT_R = 15.915
const DONUT_STROKE = 4

export type CategorySpendingCredit = {
  categoryId: string
  label: string
  color: string | null
  value: number
}

type Props = {
  /** Donut data: top-N + "Otros", already grouped and relabeled by the screen. */
  breakdown: CategoryBreakdown
  /** Ranking data: EVERY category, uncapped, so the tail can be revealed. */
  rankingSlices: CategorySlice[]
  currency: 'ARS' | 'USD'
  mode: 'egresos' | 'ingresos'
  /** Whether to offer the ARS/USD pills at all (bimoneda user). */
  hasUsd: boolean
  /** Set while drilled into a category — switches the palette to parent tints. */
  parentCategoryId?: string
  /** Localized name of the drilled category, for the breadcrumb. */
  activeCategoryName?: string
  /** Which ranking row reads as selected (the active subcategory, when drilled). */
  selectedRowId?: string | null
  credits: CategorySpendingCredit[]
  onSetMode: (mode: 'egresos' | 'ingresos') => void
  onSetCurrency: (currency: 'ARS' | 'USD') => void
  onSelectCategory: (categoryId: string) => void
  onClearCategory: () => void
}

/**
 * Native "En qué se fue" — the month's spending read by category: donut, ranking,
 * Egresos / Ingresos selector and drill into a category's subcategories.
 *
 * Same name and same public shape as web's `CategorySpendingOverview`, idiomatic
 * RN inside. Two deliberate differences from the web card:
 *
 *   - **No month selector.** The Movimientos screen already owns one, and it
 *     governs the feed, the pending blocks and this card at once. Web puts it
 *     inside the card only because that route has no other. The card READS the
 *     month; it never writes it.
 *   - **No drill animation.** Web's `AnimatedDonut` crossfade is unreachable in
 *     its own live route (the container passes `subBreakdownsByCategory`
 *     undefined, so `drillIn` returns early). The real drill on both platforms is
 *     the FILTER: tapping a row writes the category filter, the screen re-reads,
 *     and the donut swaps data. No component-local drill state means the card can
 *     never disagree with the list under it.
 */
export const CategorySpendingOverview = ({
  breakdown,
  rankingSlices,
  currency,
  mode,
  hasUsd,
  parentCategoryId,
  activeCategoryName,
  selectedRowId,
  credits,
  onSetMode,
  onSetCurrency,
  onSelectCategory,
  onClearCategory,
}: Props) => {
  const t = useT()
  const showCents = useShowCents()
  const [tailExpanded, setTailExpanded] = useState(false)

  const fmt = (n: number) =>
    currency === 'ARS' ? formatARS(n, showCents) : formatUSD(n, showCents)

  // In subcategory mode the query stamps every slice with the same parent
  // colour; recolour them as tints of that parent so each reads distinctly.
  // Brightest = largest, since slices arrive sorted by value descending.
  const subTints = useMemo(() => {
    if (mode !== 'egresos' || !parentCategoryId || breakdown.slices.length === 0) return null
    return generateSubTints(breakdown.slices[0]?.color ?? DONUT_FALLBACK, breakdown.slices.length)
  }, [mode, parentCategoryId, breakdown.slices])

  const sliceColor = (slice: { color: string | null }, index: number): string =>
    mode === 'ingresos'
      ? INCOME_PALETTE[index % INCOME_PALETTE.length]
      : subTints
        ? (subTints[index] ?? DONUT_FALLBACK)
        : (slice.color ?? DONUT_FALLBACK)

  const named = rankingSlices.slice(0, RANKING_VISIBLE)
  const tail = rankingSlices.slice(RANKING_VISIBLE)
  const tailValue = tail.reduce((acc, s) => acc + s.value, 0)
  const tailPct = tail.reduce((acc, s) => acc + s.percentage, 0)
  // Bars read as a proportion of the top category, not of the total — with a
  // long tail every bar would otherwise be a sliver.
  const maxPercentage = rankingSlices[0]?.percentage ?? 100

  const isEmpty = breakdown.slices.length === 0
  const eyebrow =
    mode === 'ingresos'
      ? t('transactions.spending.income_eyebrow')
      : activeCategoryName
        ? t('transactions.spending.eyebrow_in_category', { category: activeCategoryName })
        : t('transactions.spending.eyebrow')

  const renderRow = (slice: CategorySlice, index: number) => {
    const color = sliceColor(slice, index)
    const selected = selectedRowId != null && slice.categoryId === selectedRowId
    return (
      <Pressable
        key={slice.categoryId ?? `otros-${index}`}
        // The "Otros" bucket has no id — it is an aggregate, not a category, so
        // there is nothing to filter the list by.
        disabled={slice.categoryId === null}
        onPress={() => slice.categoryId && onSelectCategory(slice.categoryId)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={`flex-row items-center gap-3 rounded-lg px-2 py-2 ${selected ? 'bg-border-soft' : ''}`}
      >
        <View className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px] font-semibold text-text">
              {slice.label}
            </Text>
            <Text className="shrink-0 text-[11px] font-bold text-text-muted">
              {Math.round(slice.percentage)}%
            </Text>
            <Text className="shrink-0 text-[13px] font-extrabold text-text">
              {fmt(slice.value)}
            </Text>
          </View>
          <View className="h-1 overflow-hidden rounded-full bg-border-soft">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.max((slice.percentage / maxPercentage) * 100, 2)}%`,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      </Pressable>
    )
  }

  return (
    <Card className="gap-4 px-4 py-5">
      {/* ── Header: eyebrow (+ breadcrumb back) and the ARS/USD pills ───────── */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          {activeCategoryName ? (
            <Pressable
              onPress={onClearCategory}
              accessibilityRole="button"
              hitSlop={6}
              className="flex-row items-center gap-1"
            >
              <ChevronLeft size={13} color={colors.textMuted} strokeWidth={2.6} />
              <Text className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                {t('transactions.spending.eyebrow')}
              </Text>
            </Pressable>
          ) : null}
          <Text numberOfLines={2} className="text-[15px] font-extrabold text-text">
            {eyebrow}
          </Text>
          <Text className="text-[11px] text-text-soft">
            {mode === 'ingresos'
              ? t('transactions.spending.income_subtitle')
              : t('transactions.spending.subtitle_egresos')}
          </Text>
        </View>

        {hasUsd ? (
          <View className="flex-row items-center gap-1">
            {(['ARS', 'USD'] as const).map((code) => {
              const active = currency === code
              return (
                <Pressable
                  key={code}
                  onPress={() => onSetCurrency(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`rounded-full border px-2.5 py-1 ${
                    active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
                  }`}
                >
                  <Text
                    className={`text-[11px] ${active ? 'font-extrabold text-text' : 'text-text-soft'}`}
                  >
                    {code}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </View>

      {/* ── Egresos / Ingresos ──────────────────────────────────────────────── */}
      <Segmented
        value={mode}
        ariaLabel={t('transactions.spending.title')}
        options={[
          { value: 'egresos', label: t('transactions.spending.mode_egresos') },
          { value: 'ingresos', label: t('transactions.spending.mode_ingresos') },
        ]}
        onValueChange={(next) => onSetMode(next as 'egresos' | 'ingresos')}
      />

      {isEmpty ? (
        <View className="items-center py-8">
          <Text className="text-center text-[13px] text-text-muted">
            {mode === 'ingresos'
              ? t('transactions.spending.income_empty')
              : t('transactions.spending.empty')}
          </Text>
        </View>
      ) : (
        <>
          {/* ── Donut ──────────────────────────────────────────────────────── */}
          <View className="items-center">
            <View style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
              <Svg viewBox="0 0 36 36" width={DONUT_SIZE} height={DONUT_SIZE}>
                <Circle
                  cx="18"
                  cy="18"
                  r={DONUT_R}
                  fill="none"
                  stroke={colors.borderSoft}
                  strokeWidth={DONUT_STROKE}
                />
                {breakdown.slices.map((s, i) => (
                  <Circle
                    key={s.categoryId ?? `arc-${i}`}
                    cx="18"
                    cy="18"
                    r={DONUT_R}
                    fill="none"
                    stroke={sliceColor(s, i)}
                    strokeWidth={DONUT_STROKE}
                    strokeDasharray={`${s.percentage} ${100 - s.percentage}`}
                    strokeDashoffset={-s.offset}
                    transform="rotate(-90 18 18)"
                  />
                ))}
              </Svg>
              {/* Centre label sits over the SVG, so the ring stays a single path. */}
              <View className="absolute inset-0 items-center justify-center px-8">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-text-soft">
                  {mode === 'ingresos'
                    ? t('transactions.spending.income_center_label')
                    : t('transactions.spending.center_label')}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className="text-[17px] font-extrabold text-text"
                >
                  {fmt(breakdown.total)}
                </Text>
                <Text className="text-[10px] text-text-soft">
                  {t('transactions.spending.categories_caption', {
                    count: rankingSlices.length,
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Ranking ────────────────────────────────────────────────────── */}
          <View className="gap-0.5">
            {named.map(renderRow)}
            {tail.length > 0 ? (
              <>
                {tailExpanded ? tail.map((s, i) => renderRow(s, RANKING_VISIBLE + i)) : null}
                <Pressable
                  onPress={() => setTailExpanded((prev) => !prev)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2 rounded-lg px-2 py-2"
                >
                  <ChevronDown
                    size={14}
                    color={colors.textMuted}
                    strokeWidth={2.6}
                    style={{ transform: [{ rotate: tailExpanded ? '180deg' : '0deg' }] }}
                  />
                  <Text className="flex-1 text-[12px] font-semibold text-text-soft">
                    {tailExpanded
                      ? t('transactions.spending.show_less')
                      : t('transactions.spending.others_label', { count: tail.length })}
                  </Text>
                  {tailExpanded ? null : (
                    <>
                      <Text className="text-[11px] font-bold text-text-muted">
                        {Math.round(tailPct)}%
                      </Text>
                      <Text className="text-[12px] font-extrabold text-text-soft">
                        {fmt(tailValue)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        </>
      )}

      {/* ── Créditos ("te devolvieron") ─────────────────────────────────────── */}
      {/* A category whose received reimbursements outweigh its spend nets
          NEGATIVE. A donut cannot draw a negative arc, so those categories are
          listed here instead of being dropped or capped at zero. */}
      {credits.length > 0 ? (
        <View className="gap-2 rounded-lg border border-border-soft bg-page px-3 py-2.5">
          <Text className="text-[10px] font-extrabold uppercase tracking-wide text-text-soft">
            {t('transactions.spending.credits_label')}
          </Text>
          {credits.map((credit) => (
            <View key={credit.categoryId} className="flex-row items-center gap-2">
              <View
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: credit.color ?? DONUT_FALLBACK }}
              />
              <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] text-text-soft">
                {credit.label}
              </Text>
              <Text className="text-[12px] font-extrabold text-positive">
                {fmt(credit.value)}
              </Text>
            </View>
          ))}
          {/* Closing line: the centre sums the DRAWN slices, so with a category
              in credit it is neither gross nor net. Mirror of web. */}
          <View className="mt-0.5 flex-row items-center gap-2 border-t border-border-soft pt-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] font-bold text-text">
              {t('transactions.spending.net_total_label')}
            </Text>
            <Text className="text-[12px] font-extrabold text-text">
              {fmt(netAfterCredits(breakdown.total, credits))}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Why the donut can exceed what left the user's accounts this month. */}
      {mode === 'egresos' ? (
        <Text className="text-[10.5px] text-text-soft">
          {t('transactions.spending.off_ledger_note')}
        </Text>
      ) : null}
    </Card>
  )
}
