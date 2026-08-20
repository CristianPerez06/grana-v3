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

type Props = {
  /** The total block: rendered on the front face, above the group rows. */
  summary: ReactNode
  groups: CommittedDetailGroup[]
}

/**
 * Native mirror of the web `committed-body.tsx`: the body of "Compromisos" as
 * two faces in ONE box that never changes size.
 *
 * The front face stays laid out and keeps the box; the back face is absolutely
 * positioned over it, so opening a detail is provably zero pixels. On web that
 * is forced by the shared row height of the two cards; here the stack would
 * tolerate the growth, but the gesture is the same on both platforms on purpose
 * — the same card must not be operated two different ways depending on the
 * device — and swapping the whole body is also what gives the list real room.
 *
 * The hidden face is taken out of the accessibility tree AND out of touch
 * handling: `opacity: 0` alone would leave a screen reader reading both faces
 * and a finger hitting the buttons underneath.
 *
 * It is not a disclosure, so there is no `accessibilityState.expanded`: the
 * control swaps the content of a region rather than revealing an adjacent panel.
 */
export const CommittedBody = ({ summary, groups }: Props) => {
  const t = useT()
  const router = useRouter()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const open = groups.find((g) => g.key === openKey) ?? null

  return (
    <View className="relative">
      {/* Front face — stays laid out, so it is what the box measures. */}
      <View
        style={{ opacity: open === null ? 1 : 0 }}
        pointerEvents={open === null ? 'auto' : 'none'}
        accessibilityElementsHidden={open !== null}
        importantForAccessibility={open === null ? 'auto' : 'no-hide-descendants'}
      >
        {summary}
        <View className="mt-3 gap-2.5">
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
      </View>

      {/* Back face — absolutely positioned: it cannot resize the box. */}
      {open !== null && (
        <View
          accessibilityLabel={open.label}
          className="absolute inset-0 overflow-hidden rounded-2xl border border-border bg-card"
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
              className="text-[13.5px] font-extrabold text-text"
            />
          </Pressable>

          {/* Only this list scrolls — never the card. */}
          <ScrollView nestedScrollEnabled className="flex-1 px-3">
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
              className="justify-center border-t border-border-soft px-3"
            >
              <Text className="text-[12px] font-bold text-positive">{open.link.label} ›</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}
