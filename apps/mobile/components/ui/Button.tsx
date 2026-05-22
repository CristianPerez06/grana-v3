import { Pressable, Text } from 'react-native'
import type { ButtonProps, ButtonSize, ButtonVariant } from '@grana/ui-contracts'
import { colors } from '../../lib/colors'
import { Spinner } from './Spinner'

type MobileButtonProps = ButtonProps & {
  /**
   * Legacy label prop. Pre-contract call-sites pass the button label as
   * `title="..."`; new call-sites should use `children`. Both work, with
   * `children` taking precedence when present. P2 task: migrate the
   * remaining ~14 call-sites and drop this prop.
   */
  title?: string
}

// `link` is in the contract because the web Button has it. The mobile
// implementation maps it to `ghost` for now; if/when a real `<Text>`-style
// link appears in mobile, replace this fallback.
const containerVariant: Record<ButtonVariant, string> = {
  primary: 'bg-emerald',
  secondary: 'bg-border-soft',
  ghost: 'bg-transparent',
  destructive: 'bg-terracotta-soft',
  link: 'bg-transparent',
}

const textVariant: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-text',
  ghost: 'text-text-muted',
  destructive: 'text-negative',
  link: 'text-primary underline',
}

const containerSize: Record<ButtonSize, string> = {
  sm: 'h-11 px-3',
  md: 'py-2.5 px-4',
  lg: 'py-3 px-5',
}

const textSize: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}

export function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
}: MobileButtonProps) {
  const isDisabled = disabled || loading
  const label = children ?? title
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`w-full flex-row items-center justify-center rounded-xl ${containerVariant[variant]} ${containerSize[size]} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <Spinner size="sm" color={variant === 'primary' ? colors.white : colors.positive} />
      ) : (
        <Text className={`font-semibold ${textVariant[variant]} ${textSize[size]}`}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}
