import { View, Text } from 'react-native'
import type { AlertProps, AlertVariant } from '@grana/ui-contracts'

// The contract types `children` as ReactNode for parity with the web Alert.
// This mobile implementation today only renders strings inside `<Text>`;
// passing JSX is not supported and would fail at runtime.

const containerVariant: Record<AlertVariant, string> = {
  info: 'bg-slate-soft border-l-4 border-slate',
  success: 'bg-emerald-soft border-l-4 border-emerald',
  error: 'bg-error-soft border-l-4 border-error',
  warning: 'bg-warning-soft border-l-4 border-warning',
}

const titleVariant: Record<AlertVariant, string> = {
  info: 'text-slate',
  success: 'text-emerald-deep',
  error: 'text-error-deep',
  warning: 'text-warning-deep',
}

const bodyVariant: Record<AlertVariant, string> = {
  info: 'text-slate',
  success: 'text-emerald-deep',
  error: 'text-error-deep',
  warning: 'text-warning-deep',
}

export function Alert({ variant = 'info', title, children }: AlertProps) {
  return (
    <View className={`rounded-lg p-4 ${containerVariant[variant]}`}>
      {title && (
        <Text className={`mb-1 text-sm font-semibold ${titleVariant[variant]}`}>{title}</Text>
      )}
      <Text className={`text-sm leading-snug ${bodyVariant[variant]}`}>{children}</Text>
    </View>
  )
}
