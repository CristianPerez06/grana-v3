import { Text, type TextProps } from 'react-native'
import type { LabelProps } from '@grana/ui-contracts'

type MobileLabelProps = LabelProps & Omit<TextProps, 'className' | 'children'>

export function Label({ className, children, ...props }: MobileLabelProps) {
  return (
    <Text
      className={`text-sm font-medium leading-none text-text ${className ?? ''}`}
      {...props}
    >
      {children}
    </Text>
  )
}
