export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment'

export type Transaction = {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  subcategory_id: string | null
  transfer_destination_account_id: string | null
  type: TransactionType
  amount: number
  currency_code: 'ARS' | 'USD'
  date: string
  description: string | null
  is_verified: boolean
  created_at: string
  // Credit card fields
  status: 'pending' | 'paid' | null
  due_date: string | null
  is_parent: boolean
  parent_id: string | null
  installment_n: number | null
  installments_total: number | null
  card_period_id: string | null
  fx_rate_to_ars: number | null
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

export type TransactionAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
}

export type TransactionWithDetails = Transaction & {
  category: TransactionCategory | null
  subcategory: TransactionSubcategory | null
  destination_account: TransactionAccount | null
  source_account: TransactionAccount | null
  period_payments: Array<{ id: string; period_id: string }> | null
}

export type CreateIncomeInput = {
  account_id: string
  currency_code: 'ARS' | 'USD'
  amount: number
  date: string
  category_id: string
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

export type CreateTransferInput = {
  account_id: string
  transfer_destination_account_id: string
  currency_code: 'ARS' | 'USD'
  amount: number
  date: string
  description?: string
}

export type CreateAdjustmentInput = {
  account_id: string
  currency_code: 'ARS' | 'USD'
  amount: number
  date: string
  description?: string
}

export type UpdateTransferInput = {
  amount?: number
  date?: string
  description?: string | null
}

export type UpdateAdjustmentInput = {
  amount?: number
  date?: string
  description?: string | null
}
