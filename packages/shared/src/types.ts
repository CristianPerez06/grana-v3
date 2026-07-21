import type { BalanceCurrency, PairwiseDebt } from '@grana/money-logic'

// Canonical household types live in @grana/ui-contracts (single definition,
// consumed by web, mobile and @grana/movement-form). Re-exported here so the
// shared data layer is a one-stop import for the whole Compartido domain.
export type { Household, HouseholdMember } from '@grana/ui-contracts'

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
  categoryId: string | null
  categoryName: string | null
  /** Translation handles: system categories render `categories.{canonical_name}`. */
  categoryCanonicalName: string | null
  categoryIsSystem: boolean
  /** Category identity for the row icon + the month spending breakdown. */
  categoryColor: string | null
  categoryIcon: string | null
  subcategoryName: string | null
  /** Translation handles: system subcategories render `subcategories.{canonical_name}`. */
  subcategoryCanonicalName: string | null
  subcategoryIsSystem: boolean
  date: string
  /** Statement/installment due date (card expenses); null for cash/debit. The
   *  expense "impacts" the month of `dueDate` when set, else of `date`. */
  dueDate: string | null
  amount: number
  currencyCode: BalanceCurrency
  payerId: string
  payerName: string
  /** This user's assigned share of the expense, in the same currency. */
  ownShare: number
  isInstallment: boolean
}
