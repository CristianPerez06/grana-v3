export type DashboardHero = {
  ars: number
  usd: number
}

export type UpcomingItemKind = 'card_period' | 'recurrence_instance'
export type UpcomingDirection = 'pay' | 'collect'

export type UpcomingItem = {
  id: string
  kind: UpcomingItemKind
  direction: UpcomingDirection
  date: string
  label: string
  amount: number
  currency: 'ARS' | 'USD'
  href: string
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
