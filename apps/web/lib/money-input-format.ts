// MoneyAmountInput's es-AR thousands-grouping helpers now live in the shared
// `@grana/validation` package so web and mobile group/cap/canonicalize amounts
// identically. This module is kept as a thin re-export so existing web imports
// (and their tests) keep resolving from `@/lib/money-input-format`.
export {
  MAX_INTEGER_DIGITS,
  toCanonical,
  formatGrouped,
  formatForDisplay,
} from '@grana/validation'
