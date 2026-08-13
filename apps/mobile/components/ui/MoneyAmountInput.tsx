import { type ComponentProps } from 'react'
import type { MoneyAmountInputProps } from '@grana/ui-contracts'
import { toCanonical, formatForDisplay } from '@grana/validation'
import { Input } from './Input'

// Money fields MUST use this instead of a plain `<Input>` for currency.
// It forces the decimal keypad and, in the default grouping mode, groups the
// integer part es-AR style ("125000" → "125.000") while emitting a CANONICAL
// value upstream (plain digits + optional `.` decimal), so `parseMoneyInput`
// (decimal.js-backed) keeps working. The grouping/cap/canonical logic is the
// SHARED `@grana/validation` module, so this behaves identically to web's
// `money-amount-input.tsx` — same thousands dots, same 10-digit cap.
//
// Bare input shape on purpose (no label/error/margin) — mirrors web's
// abstraction level. Callers compose a `<Label>` + `<MoneyAmountInput>` + error
// `<Text>` when they need a field shell; vertical rhythm between fields is
// owned by the parent container (`flex-col gap-X`).

type InputComponentProps = ComponentProps<typeof Input>

// `className` stays in (the shared `MoneyAmountInputProps` contract declares it):
// the amount hero composes a large, centered, borderless variant by passing
// override classes (with `bare`), mirroring web's bare `money-amount-input`.
type Props = MoneyAmountInputProps &
  Omit<InputComponentProps, 'keyboardType' | 'inputMode' | 'onChangeText'> & {
    value: string
    onChangeText: (value: string) => void
    // Group the integer part with thousands dots while typing (default true).
    // Set false for non-2dp money fields (FX rates) — same opt-out as web.
    groupThousands?: boolean
    // Allow a leading `-` (e.g. an account opening "en rojo"). Default false.
    allowNegative?: boolean
  }

// Non-grouped fallback: keep digits and a single decimal separator.
const sanitize = (raw: string): string => {
  const numericOnly = raw.replace(/[^\d.,]/g, '')
  const firstSepIdx = numericOnly.search(/[.,]/)
  if (firstSepIdx === -1) return numericOnly
  const head = numericOnly.slice(0, firstSepIdx + 1)
  const tail = numericOnly.slice(firstSepIdx + 1).replace(/[.,]/g, '')
  return head + tail
}

// A `.` the user typed for cents (grouping dots never sit at the end): a dot at
// the end followed by ≤2 digits is a decimal — map it to the es-AR comma before
// canonicalizing so the numeric keypad's `.` reaches cents. RN counterpart of
// web's `.`→`,` keydown remap; a mid-number `.` stays grouping and is dropped.
const remapDecimalDot = (text: string): string => text.replace(/\.(\d{0,2})$/, ',$1')

export function MoneyAmountInput({
  value,
  onChangeText,
  groupThousands = true,
  allowNegative = false,
  ...rest
}: Props) {
  // Display the grouped text; emit canonical upstream (unchanged contract).
  const display = groupThousands ? formatForDisplay(value) : value
  return (
    <Input
      {...rest}
      value={display}
      keyboardType="decimal-pad"
      inputMode="decimal"
      onChangeText={(text) =>
        onChangeText(
          groupThousands ? toCanonical(remapDecimalDot(text), allowNegative) : sanitize(text),
        )
      }
    />
  )
}
