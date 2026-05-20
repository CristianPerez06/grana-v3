import { View, Text } from 'react-native'

type Variant = 'info' | 'success' | 'error' | 'warning'

type Props = {
  variant?: Variant
  title?: string
  children: string
}

const containerVariant: Record<Variant, string> = {
  info: 'bg-slate-soft border-l-4 border-slate',
  success: 'bg-emerald-soft border-l-4 border-emerald',
  error: 'bg-error-soft border-l-4 border-error',
  warning: 'bg-warning-soft border-l-4 border-warning',
}

const titleVariant: Record<Variant, string> = {
  info: 'text-slate',
  success: 'text-emerald-deep',
  error: 'text-error-deep',
  warning: 'text-warning-deep',
}

const bodyVariant: Record<Variant, string> = {
  info: 'text-slate',
  success: 'text-emerald-deep',
  error: 'text-error-deep',
  warning: 'text-warning-deep',
}

export function Alert({ variant = 'info', title, children }: Props) {
  return (
    <View className={`rounded-lg p-4 ${containerVariant[variant]}`}>
      {title && (
        <Text className={`mb-1 text-sm font-semibold ${titleVariant[variant]}`}>{title}</Text>
      )}
      <Text className={`text-sm leading-snug ${bodyVariant[variant]}`}>{children}</Text>
    </View>
  )
}
