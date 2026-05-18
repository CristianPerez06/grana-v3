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
      <Text className="mb-1 text-sm font-medium text-foreground">{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`h-12 rounded-lg border px-3 text-foreground bg-background ${
          error ? 'border-destructive' : focused ? 'border-primary' : 'border-input'
        }`}
        placeholderTextColor="#737373"
        {...rest}
      />
      {error ? <Text className="mt-1 text-sm text-destructive">{error}</Text> : null}
    </View>
  )
}
