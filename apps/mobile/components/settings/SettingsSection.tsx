import { Text, View } from 'react-native'
import type { SettingsSectionProps } from '@grana/ui-contracts'

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <View className={`flex-col gap-3 ${className ?? ''}`}>
      <Text className="text-xs font-medium uppercase tracking-wider text-text-soft">
        {title}
      </Text>
      <View className="rounded-2xl border border-border-soft bg-card p-4">
        {children}
      </View>
    </View>
  )
}
