import type { Database } from '@grana/supabase'
import type { RecurrenceFrequency } from './date'

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
}

export type RecurrenceSubcategory = {
  id: string
  name: string
  canonical_name: string
  category_id: string
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

export type PendingRecurrenceInstance = RecurrenceInstance & {
  recurrence: Recurrence
  account: RecurrenceAccount | null
  destination_account: RecurrenceAccount | null
  category: RecurrenceCategory | null
  subcategory: RecurrenceSubcategory | null
}

export type RecurrenceSummary = Recurrence & {
  account: RecurrenceAccount | null
  destination_account: RecurrenceAccount | null
  category: RecurrenceCategory | null
  subcategory: RecurrenceSubcategory | null
  pending_instance: RecurrenceInstance | null
}

export type RecurrenceDetail = RecurrenceSummary & {
  instances: PendingRecurrenceInstance[]
}
