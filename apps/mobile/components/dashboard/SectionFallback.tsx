import { Text, View } from 'react-native'

type Props = {
  message: string
  className?: string
}

export const SectionFallback = ({ message, className }: Props) => (
  <View
    className={`items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 ${className ?? ''}`}
  >
    <Text className="text-center text-sm text-text-muted">{message}</Text>
  </View>
)
