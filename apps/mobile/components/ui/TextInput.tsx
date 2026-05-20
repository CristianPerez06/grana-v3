import { useState } from 'react'
import { Text, TextInput as RNTextInput, type TextInputProps, View } from 'react-native'

type Props = TextInputProps & {
  label: string
  value: string
  onChangeText: (text: string) => void
  error?: string
}

export function TextInput({ label, value, onChangeText, error, ...rest }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-text">{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`h-11 rounded-lg border bg-card px-3 text-sm text-text ${
          error ? 'border-error' : focused ? 'border-emerald' : 'border-border'
        }`}
        placeholderTextColor="#8A94A3"
        {...rest}
      />
      {error ? <Text className="mt-1 text-xs text-error">{error}</Text> : null}
    </View>
  )
}
