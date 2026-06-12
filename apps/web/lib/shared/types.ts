import type { BalanceCurrency, PairwiseDebt } from '@grana/money-logic'

export type HouseholdMember = {
  userId: string
  fullName: string
  isCreator: boolean
}

export type Household = {
  id: string
  name: string
  members: HouseholdMember[]
  defaultSplit: { user_id: string; percentage: number }[]
}

/** Pairwise debt per currency (ARS/USD never merged). */
export type DebtByCurrency = Record<BalanceCurrency, PairwiseDebt>

export type PendingSettlement = {
  id: string
  amount: number
  currencyCode: BalanceCurrency
  fromUserId: string
  fromName: string
}

export type SharedExpenseItem = {
  id: string
  /** Whether this row is the expense or a reimbursement on a shared expense. */
  kind: 'expense' | 'reimbursement'
  /** Reimbursement lifecycle state for the row chip (null on expense rows). */
  reimbursementState: 'pending' | 'received' | 'cancelled' | null
  description: string | null
  categoryName: string | null
  /** Translation handles: system categories render `categories.{canonical_name}`. */
  categoryCanonicalName: string | null
  categoryIsSystem: boolean
  subcategoryName: string | null
  /** Translation handles: system subcategories render `subcategories.{canonical_name}`. */
  subcategoryCanonicalName: string | null
  subcategoryIsSystem: boolean
  date: string
  amount: number
  currencyCode: BalanceCurrency
  payerId: string
  payerName: string
  /** This user's assigned share of the expense, in the same currency. */
  ownShare: number
  isInstallment: boolean
}
