import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { MaskedAmount } from './MaskedAmount'

type Props = {
  icon: ReactNode
  iconBackground: string
  label: string
  sub: string
  ars: number
  usd: number
  children: ReactNode
}

/**
 * Native mirror of the web `committed-group.tsx`: one collapsible group of the
 * "Compromisos" card.
 *
 * The header is a Pressable with `accessibilityRole="button"` and
 * `accessibilityState={{ expanded }}` — the RN equivalent of `aria-expanded`, so
 * a screen reader announces the state and the control instead of a mute view.
 * `minHeight: 44` keeps the touch target at the platform minimum.
 */
export const CommittedGroup = ({
  icon,
  iconBackground,
  label,
  sub,
  ars,
  usd,
  children,
}: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <View className="overflow-hidden rounded-2xl border border-border">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}. ${sub}`}
        style={{ minHeight: 44 }}
        className="flex-row items-center gap-3 px-3 py-2.5"
      >
        <View
          className="size-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBackground }}
        >
          {icon}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[12.5px] font-extrabold text-text">{label}</Text>
          <Text numberOfLines={1} className="text-[10.5px] font-semibold text-text-soft">
            {sub}
          </Text>
        </View>
        <View className="items-end">
          <MaskedAmount amount={ars} currency="ARS" className="text-[15px] font-extrabold text-text" />
          {usd !== 0 && (
            <MaskedAmount
              amount={usd}
              currency="USD"
              showCentsOverride
              className="text-[10px] font-semibold text-text-soft"
            />
          )}
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={15} color={colors.textSoft} />
        </View>
      </Pressable>

      {open && <View className="px-3 pb-2.5">{children}</View>}
    </View>
  )
}
