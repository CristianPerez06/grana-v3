import { Text, type TextProps } from 'react-native'

export function Label({ className, ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-sm font-medium leading-none text-text ${className ?? ''}`}
      {...props}
    />
  )
}
