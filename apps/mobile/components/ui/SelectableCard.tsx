import { Pressable, Text, View } from 'react-native'

type Props = {
  title: string
  description: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
}

export function SelectableCard({
  title,
  description,
  selected,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`flex-col gap-2 rounded-xl border-2 bg-card p-4 ${
        selected ? 'border-emerald' : 'border-border'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-base font-semibold text-text">{title}</Text>
      <View>
        <Text className="text-sm text-text-muted">{description}</Text>
      </View>
    </Pressable>
  )
}
