// Display helpers for MoneyAmountInput's thousands-grouping mode (es-AR).
//
// The canonical value (what the input emits upstream and what `parseMoneyInput`
// consumes) is a plain string: integer digits + an optional single `.` decimal,
// no grouping — e.g. "1000", "1000.5", "1000.50".
//
// The DISPLAYED text is grouped es-AR style: `.` groups the integer part every
// three digits and `,` is the decimal separator — e.g. "1.000", "1.000,50".
//
// Crucially, in the displayed text `.` ALWAYS means grouping and `,` ALWAYS
// means decimal. That removes the ambiguity that would otherwise appear while
// typing (a grouping dot we inserted vs. a decimal the user typed) and makes
// entry robust even when the caret jumps to the end on reformat. The flip side:
// to type cents the user types `,` (the es-AR decimal key); a `.` is read as
// grouping. Fields that are not 2-decimal money amounts (e.g. FX rates) must
// opt out of grouping entirely.

const MAX_DECIMALS = 2

// Displayed text → canonical. Grouping dots are dropped; the first comma (if any)
// becomes the decimal point. Leading zeros are trimmed so typing onto a default
// "0" builds the number naturally. The fractional part is capped to 2 digits.
//
// When `allowNegative` is set, a leading `-` (e.g. an account that opens "en
// rojo") is preserved as a canonical `-` prefix. A lone `-` is kept so the user
// can type the sign before the digits; `parseMoneyInput` treats it as invalid
// until a number follows.
export const toCanonical = (raw: string, allowNegative = false): string => {
  const negative = allowNegative && raw.trimStart().startsWith('-')
  // Keep only digits and commas — this drops grouping dots and anything else.
  const cleaned = raw.replace(/[^\d,]/g, '')
  if (cleaned === '') return negative ? '-' : ''

  const firstComma = cleaned.indexOf(',')
  let intPart: string
  let decPart: string | null
  if (firstComma === -1) {
    intPart = cleaned
    decPart = null
  } else {
    intPart = cleaned.slice(0, firstComma)
    decPart = cleaned.slice(firstComma + 1).replace(/,/g, '').slice(0, MAX_DECIMALS)
  }

  intPart = intPart.replace(/^0+(?=\d)/, '') // trim leading zeros, keep the last digit
  if (intPart === '') intPart = '0'

  const body = decPart === null ? intPart : `${intPart}.${decPart}`
  return negative ? `-${body}` : body
}

// Canonical → grouped display. Groups the integer part with `.` and shows the
// decimal separator as `,`. A trailing `.` (just-typed decimal) is preserved as
// a trailing `,` so the user can keep typing the cents.
export const formatGrouped = (canonical: string): string => {
  if (canonical === '') return ''
  const negative = canonical.startsWith('-')
  const body = negative ? canonical.slice(1) : canonical
  if (body === '') return negative ? '-' : ''
  const dotIdx = body.indexOf('.')
  const intPart = dotIdx === -1 ? body : body.slice(0, dotIdx)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const out = dotIdx === -1 ? grouped : `${grouped},${body.slice(dotIdx + 1)}`
  return negative ? `-${out}` : out
}

// The input's displayed value: canonical (as stored upstream) → grouped text.
export const formatForDisplay = (canonical: string): string => formatGrouped(canonical)
