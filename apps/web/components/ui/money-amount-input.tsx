'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import type { MoneyAmountInputProps } from '@grana/ui-contracts'
import { formatForDisplay, toCanonical } from '@/lib/money-input-format'

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
//
// THOUSANDS GROUPING (default ON, es-AR: `.` groups, `,` is the decimal):
// the displayed value is grouped as the user types ("125000" → "125.000"),
// but the value emitted via `onChange` stays CANONICAL — plain digits with an
// optional single `.` decimal, no grouping — so upstream `parseMoneyInput`
// keeps working unchanged. Grouping assumes a 2-decimal money amount; fields
// that are NOT 2dp amounts (e.g. an FX rate parsed with 6 decimals, or one read
// by a naive `Number(...)` parser) MUST opt out with `groupThousands={false}`.

type Props = MoneyAmountInputProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'className'> & {
    value: string
    onChange: (value: string) => void
    // Group the integer part with thousands separators while typing. Default true.
    // Set false for non-2dp money fields (FX rates) — see note above.
    groupThousands?: boolean
  }

// Non-grouped path: keep digits + at most one decimal separator.
const sanitize = (raw: string): string => {
  const onlyNumericChars = raw.replace(/[^\d.,]/g, '')
  const firstSepIdx = onlyNumericChars.search(/[.,]/)
  if (firstSepIdx === -1) return onlyNumericChars
  const head = onlyNumericChars.slice(0, firstSepIdx + 1)
  const tail = onlyNumericChars.slice(firstSepIdx + 1).replace(/[.,]/g, '')
  return head + tail
}

export const MoneyAmountInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, groupThousands = true, ...rest }, ref) => {
    if (!groupThousands) {
      return (
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          {...rest}
        />
      )
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatForDisplay(value)}
        onChange={(e) => onChange(toCanonical(e.target.value))}
        {...rest}
      />
    )
  },
)
MoneyAmountInput.displayName = 'MoneyAmountInput'
