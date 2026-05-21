import { Text, View } from 'react-native'

type Props = {
  message: string
}

export const SectionFallback = ({ message }: Props) => (
  <View className="rounded-2xl border border-dashed border-border bg-card p-6">
    <Text className="text-center text-sm text-text-muted">{message}</Text>
  </View>
)
