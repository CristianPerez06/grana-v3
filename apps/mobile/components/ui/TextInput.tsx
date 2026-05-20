import { Text, TextInput as RNTextInput, type TextInputProps, View } from 'react-native'

type Props = TextInputProps & {
  label: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  className?: string
}

export function TextInput({ label, value, onChangeText, error, className, ...rest }: Props) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-text">{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        className={`h-11 rounded-lg border bg-card px-3 text-sm text-text placeholder:text-text-soft ${
          error ? 'border-error' : 'border-border focus:border-emerald'
        } ${className ?? ''}`}
        placeholderTextColor="#8A94A3"
        {...rest}
      />
      {error ? <Text className="mt-1 text-xs text-error">{error}</Text> : null}
    </View>
  )
}
