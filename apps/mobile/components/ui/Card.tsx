import { View, Text, type ViewProps, type TextProps } from 'react-native'
import type {
  CardContentProps,
  CardDescriptionProps,
  CardFooterProps,
  CardHeaderProps,
  CardProps,
  CardTitleProps,
} from '@grana/ui-contracts'

type ViewCardProps<P> = P & Omit<ViewProps, 'className' | 'children'>
type TextCardProps<P> = P & Omit<TextProps, 'className' | 'children'>

export function Card({ className, children, ...props }: ViewCardProps<CardProps>) {
  return (
    <View
      className={`rounded-xl border border-border bg-card shadow-sm ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: ViewCardProps<CardHeaderProps>) {
  return (
    <View className={`flex-col gap-1.5 p-6 ${className ?? ''}`} {...props}>
      {children}
    </View>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: TextCardProps<CardTitleProps>) {
  return (
    <Text
      className={`text-lg font-semibold leading-none tracking-tight text-text ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: TextCardProps<CardDescriptionProps>) {
  return (
    <Text className={`text-sm text-text-muted ${className ?? ''}`} {...props}>
      {children}
    </Text>
  )
}

export function CardContent({
  className,
  children,
  ...props
}: ViewCardProps<CardContentProps>) {
  return (
    <View className={`p-6 pt-0 ${className ?? ''}`} {...props}>
      {children}
    </View>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: ViewCardProps<CardFooterProps>) {
  return (
    <View className={`flex-row items-center p-6 pt-0 ${className ?? ''}`} {...props}>
      {children}
    </View>
  )
}
