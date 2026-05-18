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
