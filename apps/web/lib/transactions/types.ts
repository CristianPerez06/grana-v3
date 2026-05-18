export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  subcategory_id: string | null
  type: TransactionType
  amount: number
  currency_code: 'ARS' | 'USD'
  date: string
  description: string | null
  is_verified: boolean
  created_at: string
}

export type TransactionCategory = {
  id: string
  name: string
  canonical_name: string
  color: string | null
  icon: string | null
}

export type TransactionSubcategory = {
  id: string
  name: string
  canonical_name: string
  category_id: string
}

export type TransactionWithDetails = Transaction & {
  category: TransactionCategory | null
  subcategory: TransactionSubcategory | null
}

export type CreateIncomeInput = {
  account_id: string
  currency_code: 'ARS' | 'USD'
  amount: number
  date: string
  category_id?: string
  subcategory_id?: string
  description?: string
}

export type CreateExpenseInput = {
  account_id: string
  currency_code: 'ARS' | 'USD'
  amount: number
  date: string
  category_id: string
  subcategory_id?: string
  description?: string
}

export type UpdateTransactionInput = {
  amount?: number
  date?: string
  description?: string | null
  category_id?: string | null
  subcategory_id?: string | null
}
