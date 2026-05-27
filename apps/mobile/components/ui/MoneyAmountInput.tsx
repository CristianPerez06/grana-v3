import { type ComponentProps } from 'react'
import { TextInput } from './TextInput'

// Money fields MUST use this instead of a plain <TextInput> for currency.
// It forces the decimal keypad and sanitizes keystrokes down to digits plus a
// single decimal separator, so the value parsed at submit (via parseMoneyInput,
// decimal.js-backed) can't be corrupted by stray separators or letters.
//
// Mirror of apps/web/components/ui/money-amount-input.tsx. Web's reason was
// `type="number"`: wheel/arrow/spinner nudges did float math and silently
// dropped a centavo (a card-payment expense once stored 1 centavo short). RN's
// TextInput has no spinner, but forcing `decimal-pad` + the same keystroke
// sanitization keeps money input behaving identically across platforms.
//
// Not in @grana/ui-contracts on purpose: like Input/FormField, the value
// callback is the platform-native one (web `onChange`, mobile `onChangeText`),
// so there is no shared prop shape to enforce.

type Props = Omit<
  ComponentProps<typeof TextInput>,
  'keyboardType' | 'inputMode' | 'onChangeText'
> & {
  onChangeText: (value: string) => void
}

// Keep digits and a single decimal separator ('.' or ','); drop everything else.
const sanitize = (raw: string): string => {
  const numericOnly = raw.replace(/[^\d.,]/g, '')
  const firstSepIdx = numericOnly.search(/[.,]/)
  if (firstSepIdx === -1) return numericOnly
  const head = numericOnly.slice(0, firstSepIdx + 1)
  const tail = numericOnly.slice(firstSepIdx + 1).replace(/[.,]/g, '')
  return head + tail
}

export function MoneyAmountInput({ onChangeText, ...rest }: Props) {
  return (
    <TextInput
      {...rest}
      keyboardType="decimal-pad"
      inputMode="decimal"
      onChangeText={(text) => onChangeText(sanitize(text))}
    />
  )
}
