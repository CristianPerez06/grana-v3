// DB-row card types. They derive from @grana/supabase's `Database`, which the
// pure @grana/money-logic package can't depend on, so they stay per-app — same
// as the canonical mirror apps/web/lib/cards/types.ts. The PeriodStatus /
// PeriodVariant unions also live in @grana/money-logic; kept here to match web.

import type { Database } from '@grana/supabase'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type CardPeriod = Tables<'card_periods'>

export type CardPeriodWithPayment = CardPeriod & {
  has_payment: boolean
  tx_count: number
}

export type PeriodStatus = 'open' | 'closed' | 'overdue' | 'paid'

export type PeriodVariant =
  | 'futuro'
  | 'actual'
  | 'tarjeta_nueva'
  | 'cerrado_esperando_pago'
  | 'vencido'
  | 'pagado'
