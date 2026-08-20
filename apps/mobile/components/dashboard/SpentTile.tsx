import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { amountDensity, type AmountDensity } from '@grana/dashboard'
import { colors } from '../../lib/colors'
import { useShowCents } from '../../lib/preferences-context'
import { MaskedAmount } from './MaskedAmount'

export type TileTone = 'spent' | 'paid' | 'pending'

export const TILE_TONE: Record<TileTone, { iconBg: string; stroke: string; amount: string; rule: string }> = {
  spent: { iconBg: '#E7F8F0', stroke: colors.emeraldDeep, amount: 'text-positive', rule: colors.positive },
  paid: { iconBg: '#E9F0F5', stroke: colors.slate, amount: 'text-slate', rule: colors.slate },
  pending: { iconBg: '#FBF0DD', stroke: colors.warningDeep, amount: 'text-terracotta', rule: colors.terracotta },
}

export type BreakdownRow = { label: string; amount: number }

/**
 * Headline size per density step. Same thresholds as web (they come from the
 * shared `amountDensity`), different sizes: a native tile is narrower.
 */
const AMOUNT_SIZE: Record<AmountDensity, string> = {
  normal: 'text-[14.5px]',
  tight: 'text-[13px]',
  tighter: 'text-[11.5px]',
  // 9.5 and not 10: the worst case ($ 1.234.567.890,00) measures ~92px at 10px
  // against the ~89px a native tile leaves for text.
  tightest: 'text-[9.5px]',
}

type Props = {
  tone: TileTone
  icon: ReactNode
  label: string
  ars: number
  usd: number
  showUsd: boolean
  caption?: { lead: string; emphasis: string }
  breakdown?: { title: string; rows: BreakdownRow[]; openLabel: string; backLabel: string }
  flipped: boolean
  onToggle: () => void
}

/** Fixed height, so turning a tile never changes the card's shape. */
const TILE_HEIGHT = 150

/**
 * Native mirror of the web `spent-tile.tsx`.
 *
 * The web version turns the tile in 3D. Here the two faces CROSS-FADE instead:
 * React Native's `rotateY` + `backfaceVisibility` is unreliable on Android — the
 * back face renders mirrored or both paint at once — and a broken turn is worse
 * than no turn. The interaction, the fixed height and the two faces are the same;
 * only the transition differs, and it is the part of the design that carries the
 * least meaning.
 *
 * Only the visible face is mounted, so a screen reader never reads both.
 */
export const SpentTile = ({
  tone,
  icon,
  label,
  ars,
  usd,
  showUsd,
  caption,
  breakdown,
  flipped,
  onToggle,
}: Props) => {
  const tint = TILE_TONE[tone]
  const showCents = useShowCents()
  const flippable = breakdown != null

  const body = flippable && flipped ? (
    <View className="flex-1 px-2.5 pt-2.5">
      <View className="flex-row items-center gap-1.5">
        <View className="size-[7px] rounded-[2px]" style={{ backgroundColor: tint.rule }} />
        <Text className="text-[8.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {breakdown.title}
        </Text>
      </View>
      <View className="mt-2 gap-[7px]">
        {breakdown.rows.map((row) => (
          <View key={row.label}>
            <Text numberOfLines={2} className="text-[9px] font-bold leading-tight text-text-soft">
              {row.label}
            </Text>
            <MaskedAmount
              amount={row.amount}
              currency="ARS"
              className="mt-0.5 text-[11.5px] font-extrabold text-text"
            />
          </View>
        ))}
      </View>
      <View className="mb-2 mt-auto flex-row items-center gap-1">
        <ChevronLeft size={10} color={colors.textSoft} strokeWidth={2.6} />
        <Text className="text-[9px] font-extrabold text-text-soft">{breakdown.backLabel}</Text>
      </View>
    </View>
  ) : (
    <View className="flex-1 items-center px-2 pt-2.5">
      <View
        className="size-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint.iconBg }}
      >
        {icon}
      </View>
      <Text numberOfLines={2} className="mt-2 text-center text-[10.5px] font-extrabold leading-tight text-text-muted">
        {label}
      </Text>
      <MaskedAmount
        amount={ars}
        currency="ARS"
        fitOneLine
        className={`mt-1.5 font-extrabold ${AMOUNT_SIZE[amountDensity(ars, showCents)]} ${tint.amount}`}
      />
      {showUsd && (
        <MaskedAmount
          amount={usd}
          currency="USD"
          showCentsOverride
          className="mt-0.5 text-[9.5px] font-semibold text-text-soft"
        />
      )}
      {flippable ? (
        <View className="mt-2 flex-row items-center gap-1">
          <Text className="text-[9px] font-extrabold text-text-soft">{breakdown.openLabel}</Text>
          <ChevronRight size={10} color={colors.textSoft} strokeWidth={2.6} />
        </View>
      ) : (
        caption && (
          <View className="mt-2">
            <Text className="text-center text-[9px] font-bold text-text-soft">{caption.lead}</Text>
            <Text className="text-center text-[9.5px] font-extrabold text-text">
              {caption.emphasis}
            </Text>
          </View>
        )
      )}
    </View>
  )

  const content = (
    <>
      {body}
      <View className="h-1 w-full" style={{ backgroundColor: tint.rule }} />
    </>
  )

  if (!flippable) {
    return (
      <View
        style={{ height: TILE_HEIGHT }}
        className="flex-1 overflow-hidden rounded-2xl border border-border bg-card"
      >
        {content}
      </View>
    )
  }

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: flipped }}
      accessibilityLabel={label}
      style={{ height: TILE_HEIGHT }}
      className="flex-1 overflow-hidden rounded-2xl border border-border bg-card"
    >
      {content}
    </Pressable>
  )
}
