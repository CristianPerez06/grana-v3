import type { Database } from '@grana/supabase'
import type { RecurrenceFrequency } from '@grana/money-logic'

type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type RecurrenceMovementType = 'income' | 'expense' | 'transfer'
export type RecurrenceStatus = 'active' | 'paused' | 'deleted'
export type RecurrenceInstanceStatus = 'pending' | 'skipped' | 'confirmed'
export type RecurrenceCurrencyCode = 'ARS' | 'USD'

export type RecurrenceAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
}

export type RecurrenceCategory = {
  id: string
  name: string
  canonical_name: string
  color: string | null
  icon: string | null
  /** NULL = system category (translatable via `categories.{canonical_name}`). */
  user_id: string | null
}

export type RecurrenceSubcategory = {
  id: string
  name: string
  canonical_name: string
  category_id: string
  /** NULL = system subcategory (translatable via `subcategories.{canonical_name}`). */
  user_id: string | null
}

export type Recurrence = Omit<
  Tables<'recurrences'>,
  'movement_type' | 'frequency' | 'status' | 'currency_code'
> & {
  movement_type: RecurrenceMovementType
  frequency: RecurrenceFrequency
  status: RecurrenceStatus
  currency_code: RecurrenceCurrencyCode
}

export type RecurrenceInstance = Omit<
  Tables<'recurrence_instances'>,
  'status' | 'currency_code'
> & {
  status: RecurrenceInstanceStatus
  currency_code: RecurrenceCurrencyCode
}

/**
 * An instance plus the embeds the screens need — ANY instance, whatever its
 * status. `due_date` stays nullable here, because for an occurrence resolved
 * before 0064 the vencimiento is unrecoverable and the row carries `NULL` +
 * `due_date_is_unknown`. The history list renders exactly these.
 */
export type EnrichedRecurrenceInstance = RecurrenceInstance & {
  recurrence: Recurrence
  account: RecurrenceAccount | null
  destination_account: RecurrenceAccount | null
  category: RecurrenceCategory | null
  subcategory: RecurrenceSubcategory | null
}

/**
 * An enriched instance still awaiting a decision — the feed rows.
 *
 * The one thing it adds is that `due_date` is NOT nullable. An UNRESOLVED
 * occurrence always has an exact vencimiento: 0064's backfill set `pending` and
 * `skipped` rows exactly, its compatibility trigger derives it on insert for any
 * client that only writes `scheduled_date`, and it is immutable from then on.
 * `validate_schema.sql` asserts it.
 *
 * Narrowing it here is what lets every surface read the vencimiento instead of
 * `scheduled_date` — which on a resolved row is a legacy date of uncertain
 * meaning and was never the occurrence's identity. It is a promise only about
 * unresolved rows, so anything that also holds history takes
 * `EnrichedRecurrenceInstance`: claiming a non-null `due_date` for a confirmed
 * 2023 occurrence would be a lie the compiler helps spread.
 */
export type PendingRecurrenceInstance = EnrichedRecurrenceInstance & {
  due_date: string
}

export type RecurrenceSummary = Recurrence & {
  account: RecurrenceAccount | null
  destination_account: RecurrenceAccount | null
  category: RecurrenceCategory | null
  subcategory: RecurrenceSubcategory | null
  /**
   * Every occurrence of this rule still awaiting a decision, oldest first.
   *
   * A COLLECTION, not one row. The single-pending invariant is what turned an
   * unreviewed occurrence into a permanent stop (#96), so a rule can now hold
   * several at once and a surface that renders `[0]` shows one of many rather
   * than the only one. Empty when the rule is up to date.
   */
  pending_instances: RecurrenceInstance[]
  /**
   * Occurrences of this rule that ALREADY EXIST from today onward, plus its seed
   * date when the rule was created from a movement — everything a projection has
   * to subtract so it does not announce as upcoming something that already is.
   *
   * Bounded by construction: occurrences are only materialized up to today, so
   * this holds today's at most, and a future `start_date` for a seeded rule.
   * A plain array, not a Set, because it crosses the server/client boundary.
   */
  covered_occurrences: string[]
  /**
   * Next scheduled occurrence on or after today (the calendar "próximo"), or null
   * if the rule has no further occurrence. Computed from start_date — NOT from
   * `pending_instances`, whose dates are the DUE occurrences awaiting a decision
   * and are always <= today.
   */
  next_occurrence: string | null
}

export type RecurrenceDetail = RecurrenceSummary & {
  /**
   * The rule's whole history, newest first — `confirmed` and `skipped` included,
   * so `due_date` may be NULL. NOT `PendingRecurrenceInstance[]`: that type
   * promises an exact vencimiento, which only an unresolved occurrence has.
   */
  instances: EnrichedRecurrenceInstance[]
}
