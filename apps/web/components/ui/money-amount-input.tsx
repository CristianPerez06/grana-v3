'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import type { MoneyAmountInputProps } from '@grana/ui-contracts'

// MoneyAmountInput — money fields MUST use this instead of `<input type="number">`.
//
// `type="number"` reacts to mouse wheel, arrow keys and spinner buttons. Each
// step nudge does float arithmetic against `step` (e.g. 0.01), so a focused
// number input on a value like 3000 can silently become 2999.99 if the user
// scrolls the page or taps an arrow. We hit this in production paying a card
// period: the expense was stored 1 centavo short. `type="text" inputMode="decimal"`
// removes all three vectors at once and keeps the numeric keypad on mobile.
//
// Validation/parsing happens upstream via `parseMoneyInput` (decimal.js-backed).
// This component only filters keystrokes so users can't type letters.

type Props = MoneyAmountInputProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'className'> & {
    value: string
    onChange: (value: string) => void
  }

const sanitize = (raw: string): string => {
  const onlyNumericChars = raw.replace(/[^\d.,]/g, '')
  const firstSepIdx = onlyNumericChars.search(/[.,]/)
  if (firstSepIdx === -1) return onlyNumericChars
  const head = onlyNumericChars.slice(0, firstSepIdx + 1)
  const tail = onlyNumericChars.slice(firstSepIdx + 1).replace(/[.,]/g, '')
  return head + tail
}

export const MoneyAmountInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, ...rest }, ref) => (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(sanitize(e.target.value))}
      {...rest}
    />
  ),
)
MoneyAmountInput.displayName = 'MoneyAmountInput'
