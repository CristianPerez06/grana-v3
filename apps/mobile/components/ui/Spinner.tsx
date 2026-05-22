import { ActivityIndicator } from 'react-native'
import type { SpinnerProps } from '@grana/ui-contracts'

type MobileSpinnerProps = SpinnerProps & {
  /** React Native-specific: stroke color (ignored by web). */
  color?: string
}

const sizeMap = { sm: 'small', md: 'small', lg: 'large' } as const

export function Spinner({
  size = 'md',
  color = '#10B981',
  label,
}: MobileSpinnerProps) {
  return (
    <ActivityIndicator
      size={sizeMap[size]}
      color={color}
      accessibilityLabel={label}
    />
  )
}
