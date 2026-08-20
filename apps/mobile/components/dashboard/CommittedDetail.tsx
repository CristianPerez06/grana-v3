import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { CommittedRow } from './CommittedRow'
import { MaskedAmount } from './MaskedAmount'

export type CommittedDetailGroup = {
  key: string
  icon: ReactNode
  iconBackground: string
  label: string
  /** Summary-state subtitle: how many items make the total up. */
  sub: string
  ars: number
  usd: number
  rows: { id: string; label: string; amount: number }[]
  emptyMessage: string
  link?: { href: string; label: string }
}

/** Max height of the open list before it scrolls inside the zone. */
const LIST_MAX_HEIGHT = 172

/**
 * Native mirror of the web `committed-detail.tsx`: the detail zone of
 * "Compromisos", with two states that occupy the same space — the two group
 * summaries, or one group's list.
 *
 * The detail REPLACES the summary instead of unfolding below it. On web that is
 * forced by the shared row height (everything this card grows becomes a hole in
 * "Cuánto gastaste"); here the stack would tolerate the growth, but the gesture
 * is the same on both platforms on purpose — the same card must not be operated
 * two different ways depending on the device.
 *
 * It is NOT a disclosure, so there is no `accessibilityState.expanded`: the
 * control swaps the content of a region rather than revealing an adjacent panel.
 */
export const CommittedDetail = ({ groups }: { groups: CommittedDetailGroup[] }) => {
  const t = useT()
  const router = useRouter()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = groups.find((g) => g.key === openKey) ?? null

  if (open === null) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={t('dashboard.committed.detail_region')}
        className="gap-2.5"
      >
        {groups.map((group) => (
          <Pressable
            key={group.key}
            onPress={() => setOpenKey(group.key)}
            accessibilityRole="button"
            accessibilityLabel={`${group.label}. ${group.sub}`}
            style={{ minHeight: 44 }}
            className="flex-row items-center gap-3 rounded-2xl border border-border px-3 py-2.5"
          >
            <View
              className="size-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: group.iconBackground }}
            >
              {group.icon}
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[12.5px] font-extrabold text-text">{group.label}</Text>
              <Text numberOfLines={1} className="text-[10.5px] font-semibold text-text-soft">
                {group.sub}
              </Text>
            </View>
            <View className="items-end">
              <MaskedAmount
                amount={group.ars}
                currency="ARS"
                className="text-[15px] font-extrabold text-text"
              />
              {group.usd !== 0 && (
                <MaskedAmount
                  amount={group.usd}
                  currency="USD"
                  showCentsOverride
                  className="text-[10px] font-semibold text-text-soft"
                />
              )}
            </View>
            <ChevronRight size={15} color={colors.textSoft} />
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View
      accessibilityLabel={t('dashboard.committed.detail_region')}
      className="overflow-hidden rounded-2xl border border-border"
    >
      <Pressable
        onPress={() => setOpenKey(null)}
        accessibilityRole="button"
        accessibilityLabel={`${t('dashboard.committed.back')}. ${open.label}`}
        style={{ minHeight: 44 }}
        className="flex-row items-center gap-2 border-b border-border-soft px-3 py-2.5"
      >
        <ChevronLeft size={15} color={colors.textSoft} />
        <Text numberOfLines={1} className="flex-1 text-[12.5px] font-extrabold text-text">
          {open.label}
        </Text>
        <MaskedAmount
          amount={open.ars}
          currency="ARS"
          className="text-[12.5px] font-extrabold text-text"
        />
      </Pressable>

      {/* Only this list scrolls — never the card. */}
      <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} nestedScrollEnabled className="px-3">
        {open.rows.length === 0 ? (
          <Text className="py-2.5 text-[12px] font-semibold text-text-soft">
            {open.emptyMessage}
          </Text>
        ) : (
          open.rows.map((row, index) => (
            <CommittedRow
              key={row.id}
              label={row.label}
              amount={row.amount}
              currency="ARS"
              first={index === 0}
            />
          ))
        )}
      </ScrollView>

      {open.link && (
        <Pressable
          onPress={() => router.push(open.link!.href)}
          accessibilityRole="button"
          style={{ minHeight: 44 }}
          className="justify-center px-3"
        >
          <Text className="text-[12px] font-bold text-positive">{open.link.label} ›</Text>
        </Pressable>
      )}
    </View>
  )
}
