import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import type { PageHeaderProps } from '@grana/ui-contracts'

export function PageHeader({ title, description, backLink, actions }: PageHeaderProps) {
  return (
    <View className="flex-col gap-3">
      {backLink && (
        <View className="flex-row items-center">
          <Link href={backLink.href} asChild>
            <Pressable>
              <Text className="text-sm text-text-soft">← {backLink.label}</Text>
            </Pressable>
          </Link>
        </View>
      )}
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="flex-1 flex-col gap-1">
          <Text
            accessibilityRole="header"
            className="text-2xl font-semibold text-foreground"
          >
            {title}
          </Text>
          {description && (
            <Text className="text-sm text-text-soft">{description}</Text>
          )}
        </View>
        {actions && <View className="shrink-0">{actions}</View>}
      </View>
    </View>
  )
}
