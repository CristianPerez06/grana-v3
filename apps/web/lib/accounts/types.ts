import type { ResolvedAccountAvatar } from '@grana/ui-contracts'

export type AccountType = 'cash' | 'bank' | 'credit'

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution_id: string | null
  is_active: boolean
  created_at: string
  color_key: string | null
  icon_key: string | null
}

export type AccountCurrency = {
  id: string
  account_id: string
  currency_code: 'ARS' | 'USD'
  initial_balance: number
  initial_balance_date: string
  is_active: boolean
  created_at: string
}

export type Institution = {
  id: string
  name: string
  slug: string
  brand_color: string | null
  icon_type: string | null
  is_active: boolean
}

export type AccountWithDetails = Account & {
  institution: Institution | null
  currencies: AccountCurrency[]
}

export type AccountWithBalances = AccountWithDetails & {
  balances: Record<'ARS' | 'USD', number>
  /** Visual identity resolved server-side from color_key/icon_key + institution. */
  avatar: ResolvedAccountAvatar
}

export type GroupedAccounts = {
  cash: AccountWithDetails[]
  bank: AccountWithDetails[]
}
