import { Pressable, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { colors } from '../../lib/colors'

export type ActiveFilterChip = {
  key: string
  label: string
  onRemove: () => void
}

/**
 * Removable active-filter chips, shared by the Movimientos feed and the account
 * detail. A pure renderer on purpose: it does NOT build the chip list. Labels
 * depend on each surface's own option catalog and on which filters that surface
 * offers, so composing the list is the host's job — this only draws it, so the
 * two surfaces can't drift on how a removable chip looks or behaves.
 */
export function ActiveFilterChips({ chips }: { chips: ActiveFilterChip[] }) {
  if (chips.length === 0) return null

  return (
    <View className="flex-row flex-wrap gap-2">
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.onRemove}
          accessibilityRole="button"
          className="flex-row items-center gap-1 rounded-full bg-border-soft px-2.5 py-1"
        >
          <Text className="text-[12px] font-semibold text-text-muted">{chip.label}</Text>
          <X size={12} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  )
}
