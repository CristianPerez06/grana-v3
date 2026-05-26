import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import type { PageHeaderProps } from '@grana/ui-contracts'

export function PageHeader({ title, description, backLink, actions }: PageHeaderProps) {
  return (
    <SafeAreaView edges={['top']} className="bg-navy">
      <View className="flex-col gap-3 px-6 pb-4 pt-3">
        {backLink ? (
          <View className="flex-row items-center">
            <Link href={backLink.href} asChild>
              <Pressable hitSlop={8}>
                <Text className="text-sm text-navy-muted">← {backLink.label}</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View className="h-5" />
        )}
        <View className="flex-row flex-wrap items-start justify-between gap-2">
          <View className="flex-1 flex-col gap-1">
            <Text
              accessibilityRole="header"
              className="text-2xl font-semibold text-white"
            >
              {title}
            </Text>
            {description && (
              <Text className="text-sm text-navy-muted">{description}</Text>
            )}
          </View>
          {actions && <View className="shrink-0">{actions}</View>}
        </View>
      </View>
    </SafeAreaView>
  )
}
