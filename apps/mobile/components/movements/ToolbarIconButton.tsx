import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

type Props = {
  icon: ReactNode
  /** Accessible name — the icon carries no visible text. */
  label: string
  active?: boolean
  badge?: number
  onPress: () => void
}

/**
 * 36×36 icon button of a movements toolbar (search, recurrences, filters) — the
 * native twin of web's `iconButtonCls` in `MovementFilters`: same size, radius,
 * border and count badge. Shared by the Movimientos tab and the account detail
 * so both toolbars read like the web ones.
 */
export function ToolbarIconButton({ icon, label, active = false, badge, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      // 36px drawn, 44px touchable — the platform-forced touch target.
      hitSlop={4}
      className={`h-9 w-9 items-center justify-center rounded-[10px] border ${
        active ? 'border-emerald bg-emerald-soft' : 'border-border bg-card'
      }`}
    >
      {icon}
      {badge !== undefined && (
        <View className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-navy px-1">
          <Text className="text-[10px] font-semibold text-white">{badge}</Text>
        </View>
      )}
    </Pressable>
  )
}
