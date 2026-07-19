import type { RecurrenceMovementType } from '@grana/recurrences'
import type { RecurrenceFrequency } from '@grana/money-logic'

// The minimal category shape both the rule/instance category and the (slimmer)
// suggestion category satisfy — only these fields drive the display name.
type NamedCategory = {
  name: string
  canonical_name: string
  user_id: string | null
}

type Translate = (key: string, values?: Record<string, string | number>) => string

// Frequency badge label (weekly/biweekly/monthly/annual/custom). Reuses the
// shared `recurrences.frequencies.*` catalog.
export const frequencyLabel = (frequency: RecurrenceFrequency, t: Translate): string =>
  t(`recurrences.frequencies.${frequency}`)

// Movement-type label for a rule with no description/category (transfers).
export const movementLabel = (type: RecurrenceMovementType, t: Translate): string =>
  t(`transactions.types.${type}`)

// System categories translate via `categories.{canonical_name}`; user categories
// keep their stored name. Mirror of the resolver used across the mobile app.
export const categoryName = (
  category: NamedCategory | null,
  t: Translate,
): string | null => {
  if (!category) return null
  return category.user_id === null ? t(`categories.${category.canonical_name}`) : category.name
}

// Amount sign + tone class by movement type (income emerald, transfer navy,
// expense terracotta) — the structural tokens the rest of the app uses.
export const amountSign = (type: RecurrenceMovementType): string =>
  type === 'income' ? '+' : type === 'expense' ? '−' : ''

export const amountToneClass = (type: RecurrenceMovementType): string =>
  type === 'income'
    ? 'text-emerald-deep'
    : type === 'transfer'
      ? 'text-navy'
      : 'text-terracotta'
