import { View, Text, type TextInputProps } from 'react-native'
import { Input } from './Input'
import { Label } from './Label'

type Props = TextInputProps & {
  label: string
  error?: string
  description?: string
}

export function FormField({ label, error, description, ...inputProps }: Props) {
  return (
    <View className="flex-col gap-1.5">
      <Label>{label}</Label>
      <Input invalid={Boolean(error)} {...inputProps} />
      {description && !error && (
        <Text className="text-xs text-text-muted">{description}</Text>
      )}
      {error && <Text className="text-xs text-error">{error}</Text>}
    </View>
  )
}
