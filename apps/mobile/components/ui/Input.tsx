import { useState } from 'react'
import { TextInput as RNTextInput, type TextInputProps } from 'react-native'
import type { InputProps } from '@grana/ui-contracts'

type MobileInputProps = InputProps & TextInputProps

export function Input({ invalid, className, ...props }: MobileInputProps) {
  const [focused, setFocused] = useState(false)

  const borderClass = invalid
    ? 'border-error'
    : focused
      ? 'border-emerald'
      : 'border-border'

  return (
    <RNTextInput
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`h-11 w-full rounded-lg border bg-card px-3 text-sm text-text ${borderClass} ${className ?? ''}`}
      placeholderTextColor="#8A94A3"
      {...props}
    />
  )
}
