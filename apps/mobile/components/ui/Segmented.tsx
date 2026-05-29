import { Pressable, Text, View } from 'react-native'
import type { SegmentedProps } from '@grana/ui-contracts'

/**
 * Single-select segmented control. Mirrors apps/web/components/ui/segmented.tsx
 * via the shared SegmentedProps contract. Exactly one option is active; a
 * disabled option never fires onValueChange.
 */
export function Segmented({
  value,
  options,
  onValueChange,
  ariaLabel,
}: SegmentedProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ariaLabel}
      className="flex-row items-center gap-1 rounded-xl bg-border-soft p-1"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            disabled={option.disabled}
            onPress={() => {
              if (!option.disabled) onValueChange(option.value)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: option.disabled }}
            className={`flex-1 items-center rounded-lg px-3 py-1.5 ${active ? 'bg-card' : ''} ${option.disabled ? 'opacity-40' : ''}`}
          >
            <Text className={`text-sm font-bold ${active ? 'text-text' : 'text-text-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
