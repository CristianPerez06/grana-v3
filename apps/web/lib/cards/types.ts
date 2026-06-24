import type { Database } from '@grana/supabase'

// `CardPeriodWithPayment` and `PeriodVariant` are owned by the shared data layer
// (`@grana/cards` re-exports them from `@grana/transactions-mutations` and
// `@grana/money-logic`). Re-exported here so existing `@/lib/cards/types`
// importers keep a single source of truth.
export type { CardPeriodWithPayment, PeriodVariant } from '@grana/cards'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type CardPeriod = Tables<'card_periods'>

export type PeriodStatus = 'open' | 'closed' | 'overdue' | 'paid'
