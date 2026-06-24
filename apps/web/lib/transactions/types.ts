// The account-scoped read slice and its types now live in `@grana/transactions`
// so mobile can reuse them. Re-exported here so the rest of the app keeps
// importing these types from `@/lib/transactions/types` unchanged. The mutation
// input types below stay in web (the feed/writes still live here).
export type {
  Transaction,
  TransactionType,
  ReimbursementTarget,
  TransactionCategory,
  TransactionSubcategory,
  TransactionAccount,
  TransactionWithDetails,
  PendingReimbursementVM,
} from '@grana/transactions'

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
