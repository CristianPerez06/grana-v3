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
  '2xs': 'h-5 px-2',
  xs: 'h-7 px-2.5',
  sm: 'h-11 px-3',
  md: 'py-2.5 px-4',
  lg: 'py-3 px-5',
  icon: 'h-9 w-9 p-0 rounded-full',
  fab: 'h-16 w-16 p-0 rounded-2xl',
}

const textSize: Record<ButtonSize, string> = {
  '2xs': 'text-[11px]',
  xs: 'text-[13px]',
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
  icon: 'text-sm',
  fab: 'text-base',
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
      // El botón compacto mide 28px, menos que el mínimo que se puede tocar con
      // el pulgar: `hitSlop` le devuelve los 44px sin agrandar lo que se ve. Web
      // hace lo mismo con un `::after`, que es la divergencia que el repo admite.
      hitSlop={size === 'xs' || size === '2xs' ? 8 : undefined}
      // `2xs` se mide por su contenido; todo lo demás ocupa el ancho. Es la
      // acción que convive con un chip de estado adentro de una fila, y a ancho
      // completo se ve como una barra gris atravesando la tarjeta. El gemelo
      // web hace lo mismo con `w-auto`.
      className={`${size === '2xs' ? '' : 'w-full'} flex-row items-center justify-center rounded-xl ${containerVariant[variant]} ${containerSize[size]} ${isDisabled ? 'opacity-50' : ''}`}
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
