import { Switch, Text, View } from 'react-native'
import type { ShowCentsToggleProps } from '@grana/ui-contracts'
import { colors } from '../../lib/colors'

export function ShowCentsToggle({
  value,
  onValueChange,
  disabled = false,
  label,
  description,
}: ShowCentsToggleProps) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-1 pr-2">
        <Text className="text-sm font-semibold text-text">{label}</Text>
        {description && (
          <Text className="text-xs text-text-soft mt-0.5">{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderSoft, true: colors.positive }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.borderSoft}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  )
}
