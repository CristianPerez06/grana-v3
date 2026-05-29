import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getEditableFields } from '@grana/money-logic'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import type { MovementEditContext } from '@/app/(app)/transactions/new/_components/movement-form'

export type MovementEditData = {
  edit: MovementEditContext
  categories: CategoryWithSubcategories[]
}

/**
 * Builds the edit context + category tree for a transaction, shared by the
 * `/transactions/[txId]/edit` page and the in-context edit drawer opened from
 * the movement detail. Returns null when the movement can't be edited through
 * this form (missing, reimbursement, or a parent without resolvable account) —
 * the caller decides whether to 404 or hide the affordance.
 */
export async function buildMovementEditContext(
  txId: string,
  returnHref: string,
): Promise<MovementEditData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [transaction, categories] = await Promise.all([
    getTransactionDetail(txId),
    getAllCategories(user.id),
  ])
  if (!transaction) return null

  const isParent = transaction.is_parent === true
  if (!isParent && !transaction.account_id) return null
  // Reimbursements are not edited through this form — they use confirm/cancel.
  if (transaction.type === 'reimbursement') return null

  // Installment parent (madre): account_id is NULL; resolve a child's card
  // account and whether any child is paid (locks the amount).
  let accountId: string
  let hasPaidInstallment = false
  let cardName: string | null = null
  if (isParent) {
    const family = await getInstallmentFamily(transaction.id)
    accountId = family.children[0]?.account_id ?? ''
    hasPaidInstallment = family.children.some((c) => c.status === 'paid')
    cardName = family.children.find((c) => c.source_account)?.source_account?.name ?? null
    if (!accountId) return null
  } else {
    accountId = transaction.account_id as string
  }

  const isCardPayment =
    Array.isArray(transaction.period_payments) && transaction.period_payments.length > 0

  const editableFields = getEditableFields({
    type: transaction.type,
    status: transaction.status,
    isParent,
    isCardPayment,
    hasPaidInstallment,
  })

  // Available balance of the movement's own account, in the movement currency,
  // for the soft negative-balance warning. Parents (credit, off-ledger) skip it.
  const ownerDetail = transaction.account_id
    ? await getAccountDetail(transaction.account_id)
    : null
  const availableBalance = ownerDetail?.balances[transaction.currency_code] ?? 0

  const edit: MovementEditContext = {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    accountId,
    destinationAccountId: transaction.transfer_destination_account_id,
    isParent,
    amount: Math.abs(transaction.amount),
    signedAmount: transaction.amount,
    date: transaction.date,
    currencyCode: transaction.currency_code,
    destinationCurrency: transaction.destination_currency,
    destinationAmount: transaction.destination_amount,
    categoryId: transaction.category_id,
    subcategoryId: transaction.subcategory_id,
    description: transaction.description,
    installmentsTotal: transaction.installments_total,
    sourceAccountName: isParent ? cardName : transaction.source_account?.name ?? null,
    destinationAccountName: transaction.destination_account?.name ?? null,
    editableFields,
    availableBalance,
    returnHref,
  }

  return { edit, categories }
}
