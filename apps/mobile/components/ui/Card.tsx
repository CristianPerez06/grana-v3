import { View, Text, type ViewProps, type TextProps } from 'react-native'

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-xl border border-border bg-card shadow-sm ${className ?? ''}`}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-col gap-1.5 p-6 ${className ?? ''}`} {...props} />
}

export function CardTitle({ className, ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-lg font-semibold leading-none tracking-tight text-text ${className ?? ''}`}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: TextProps & { className?: string }) {
  return <Text className={`text-sm text-text-muted ${className ?? ''}`} {...props} />
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`p-6 pt-0 ${className ?? ''}`} {...props} />
}

export function CardFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-row items-center p-6 pt-0 ${className ?? ''}`} {...props} />
}
