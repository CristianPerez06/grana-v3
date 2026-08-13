import { useState } from 'react'
import { TextInput as RNTextInput, type TextInputProps } from 'react-native'
import type { InputProps } from '@grana/ui-contracts'

// `bare` drops the field shell (height/border/bg/padding/text-sm) so a caller
// can style the input freely — used by the amount hero's big centered number,
// where the shell's `text-sm`/`h-11` would otherwise override the large size.
type MobileInputProps = InputProps & TextInputProps & { bare?: boolean }

export function Input({ invalid, className, bare = false, ...props }: MobileInputProps) {
  const [focused, setFocused] = useState(false)

  const borderClass = invalid
    ? 'border-error'
    : focused
      ? 'border-emerald'
      : 'border-border'

  const shell = bare
    ? ''
    : `h-11 w-full rounded-lg border bg-card px-3 text-sm text-text ${borderClass}`

  return (
    <RNTextInput
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`${shell} ${className ?? ''}`}
      placeholderTextColor="#8A94A3"
      {...props}
    />
  )
}
