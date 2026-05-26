export type HeroAccountBalance = {
  id: string
  name: string
  ars: number
  usd: number
}

export type DashboardHero = {
  ars: number
  usd: number
  /**
   * Per-account breakdown (cash/bank only), ordered by ARS balance desc.
   * Consumed by the desktop Hero; mobile renders only the totals above.
   */
  accounts: HeroAccountBalance[]
}

export type UpcomingItemKind = 'card_period' | 'recurrence_instance'
export type UpcomingDirection = 'pay' | 'collect'

export type UpcomingItemTarget =
  | { kind: 'card_period'; accountId: string; periodId: string }
  | { kind: 'recurrence_instance'; recurrenceInstanceId: string }

export type UpcomingItem = {
  id: string
  kind: UpcomingItemKind
  direction: UpcomingDirection
  date: string
  label: string
  amount: number
  currency: 'ARS' | 'USD'
  target: UpcomingItemTarget
}

export type UpcomingFortnight = {
  toPay: UpcomingItem[]
  toCollect: UpcomingItem[]
}

export type MonthBalanceDay = {
  day: number
  accumulatedBalance: number
  dailyIncome: number
  dailyExpense: number
}

export type MonthBalanceSeries = {
  year: number
  month: number
  days: MonthBalanceDay[]
  totalIncome: number
  totalExpense: number
  finalBalance: number
}
