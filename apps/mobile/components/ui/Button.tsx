import { Pressable, Text } from 'react-native'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

type Props = {
  title: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
}

const containerVariant: Record<Variant, string> = {
  primary: 'bg-emerald',
  secondary: 'bg-border-soft',
  ghost: 'bg-transparent',
  destructive: 'bg-terracotta-soft',
}

const textVariant: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text',
  ghost: 'text-text-muted',
  destructive: 'text-negative',
}

const containerSize: Record<Size, string> = {
  sm: 'h-11 px-3',
  md: 'py-2.5 px-4',
  lg: 'py-3 px-5',
}

const textSize: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
}: Props) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`w-full flex-row items-center justify-center rounded-xl ${containerVariant[variant]} ${containerSize[size]} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <Spinner size="sm" color={variant === 'primary' ? '#ffffff' : '#10B981'} />
      ) : (
        <Text className={`font-semibold ${textVariant[variant]} ${textSize[size]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}
