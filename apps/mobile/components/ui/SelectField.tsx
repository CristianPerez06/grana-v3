import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { colors } from '../../lib/colors'

type Props = {
  /** Rendered when there's a selection (e.g. avatar + name). */
  value?: ReactNode
  placeholder: string
  onPress: () => void
  invalid?: boolean
}

/**
 * Compact trigger-row that opens a `SelectSheet`: shows the current selection
 * (or a placeholder) and a chevron affordance. Mirror of `BankSelector`'s
 * trigger, generalized so any field can drive a sheet picker.
 */
export function SelectField({ value, placeholder, onPress, invalid }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-[52px] flex-row items-center justify-between rounded-xl border bg-card px-3 py-2.5 ${
        invalid ? 'border-error' : 'border-border'
      }`}
    >
      {value ? (
        <View className="flex-1">{value}</View>
      ) : (
        <Text className="flex-1 text-sm text-text-soft">{placeholder}</Text>
      )}
      <ChevronDown size={18} color={colors.textMuted} />
    </Pressable>
  )
}

/**
 * A row inside a `SelectSheet`: optional leading node (avatar), primary +
 * optional secondary/hint text, and a ✓ when selected. Shared by the account
 * and category pickers.
 */
export function SheetRow({
  leading,
  primary,
  secondary,
  hint,
  trailing,
  selected,
  onPress,
}: {
  leading?: ReactNode
  primary: string
  secondary?: string
  hint?: string
  /** Trailing node shown when not selected (e.g. a drill chevron). */
  trailing?: ReactNode
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-3 border-b border-border-soft py-3"
    >
      {leading}
      <View className="flex-1 flex-col">
        <Text className="text-sm text-text">{primary}</Text>
        {secondary && <Text className="text-xs text-text-muted">{secondary}</Text>}
        {hint && <Text className="text-xs text-text-soft">{hint}</Text>}
      </View>
      {selected ? <Text className="text-sm font-medium text-emerald">✓</Text> : trailing}
    </Pressable>
  )
}
