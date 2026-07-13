'use client'

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import type { MoneyAmountInputProps } from '@grana/ui-contracts'
import { evaluateMoneyExpression } from '@grana/validation'
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
//
// EXPRESSION MODE: the moment the typed text contains an arithmetic operator
// (`+ - × ÷ ( )`), the field shows the expression verbatim and does NOT emit a
// canonical value — an in-progress "1200+" is not a number. On Enter or blur it
// resolves the expression via `evaluateMoneyExpression` and emits the canonical
// total (an invalid/incomplete expression is kept so the user can fix it). A
// text with no operator behaves exactly as before. NOTE: inside an expression
// `.` and `,` both mean DECIMAL (so "1.000+5" reads as 1.0 + 5); grouping only
// applies to a bare number, which never reaches the evaluator.

type Props = MoneyAmountInputProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'className'> & {
    value: string
    onChange: (value: string) => void
    // Group the integer part with thousands separators while typing. Default true.
    // Set false for non-2dp money fields (FX rates) — see note above.
    groupThousands?: boolean
    // Allow a leading minus sign (e.g. an account opening "en rojo"). Default
    // false — most money fields (expense amounts, etc.) must stay non-negative.
    allowNegative?: boolean
  }

// Detect an arithmetic expression: any of `+ * / × ÷ ( )`, or a binary minus (a
// digit followed by `-`). A lone leading `-` is NOT a binary minus, so a
// negative opening balance ("-5") keeps its normal non-expression path.
const EXPRESSION_RE = /[+*/×÷()]|\d\s*-/
const looksLikeExpression = (raw: string): boolean => EXPRESSION_RE.test(raw)

// Non-grouped path: keep digits + at most one decimal separator. A leading `-`
// is preserved only when `allowNegative` is set.
const sanitize = (raw: string, allowNegative: boolean): string => {
  const negative = allowNegative && raw.trimStart().startsWith('-')
  const onlyNumericChars = raw.replace(/[^\d.,]/g, '')
  const firstSepIdx = onlyNumericChars.search(/[.,]/)
  const sign = negative ? '-' : ''
  if (firstSepIdx === -1) return sign + onlyNumericChars
  const head = onlyNumericChars.slice(0, firstSepIdx + 1)
  const tail = onlyNumericChars.slice(firstSepIdx + 1).replace(/[.,]/g, '')
  return sign + head + tail
}

export const MoneyAmountInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, groupThousands = true, allowNegative = false, onBlur, onKeyDown, ...rest }, ref) => {
    // Text of an in-progress expression; null in the steady (non-expression)
    // state, where the input is byte-for-byte its pre-expression self.
    const [draft, setDraft] = useState<string | null>(null)

    // An external change to `value` (a currency switch, an edit prefill, or the
    // calculator keypad writing a result) supersedes any in-progress expression,
    // so the field shows the authoritative value rather than a stale draft. A
    // committed expression also lands here (commit calls onChange), which just
    // clears the already-cleared draft — harmless.
    const prevValue = useRef(value)
    useEffect(() => {
      if (prevValue.current !== value) {
        prevValue.current = value
        setDraft(null)
      }
    }, [value])

    // Resolve the draft on commit. On success emit the canonical total and drop
    // the draft; on failure keep the draft so the user can correct it.
    const commitDraft = (): void => {
      if (draft === null) return
      const result = evaluateMoneyExpression(draft)
      if (result === null) return
      if (!allowNegative && result < 0) return
      onChange(String(result))
      setDraft(null)
    }

    const handleChange = (raw: string): void => {
      if (looksLikeExpression(raw)) {
        // Entering expression mode from the grouped display: the visible text
        // (e.g. "1.200+") carries thousands-grouping dots the evaluator would
        // otherwise read as decimals, turning "1.200" into 1.2. Strip grouping
        // (`.`) and map the es-AR decimal (`,`) to `.` so the seed is a clean
        // expression. Once in draft mode the text is already ungrouped, so we
        // keep subsequent keystrokes verbatim (a typed `.` there is a decimal).
        const next =
          draft === null && groupThousands ? raw.replace(/\./g, '').replace(/,/g, '.') : raw
        setDraft(next)
        return
      }
      if (draft !== null) setDraft(null)
      onChange(groupThousands ? toCanonical(raw, allowNegative) : sanitize(raw, allowNegative))
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
      commitDraft()
      onBlur?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      onKeyDown?.(e)
      if (e.defaultPrevented) return
      if (e.key === 'Enter' && draft !== null) {
        e.preventDefault()
        commitDraft()
        return
      }
      // Grouping dots are inserted by the formatter, never typed — so a typed `.`
      // can only mean "decimal". Map the `.` key (incl. the numeric keypad's) to
      // the es-AR decimal `,` at the caret so numpad users get cents instead of a
      // silently-100x-larger integer. Paste is untouched (it still flows through
      // toCanonical, where `.` is grouping), so pasting "1.000" stays 1000. In
      // expression mode `.` is a literal decimal the evaluator understands, so we
      // leave it alone.
      if (!groupThousands || draft !== null || e.key !== '.') return
      e.preventDefault()
      const input = e.currentTarget
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? input.value.length
      const next = `${input.value.slice(0, start)},${input.value.slice(end)}`
      onChange(toCanonical(next, allowNegative))
    }

    const displayValue = draft ?? (groupThousands ? formatForDisplay(value) : value)

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      />
    )
  },
)
MoneyAmountInput.displayName = 'MoneyAmountInput'
