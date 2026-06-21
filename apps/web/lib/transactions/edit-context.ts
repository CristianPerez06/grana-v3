import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getEditableFields } from '@grana/money-logic'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import type { Household } from '@/lib/shared/types'
import type { MovementEditContext } from '@/lib/transactions/components/movement-form'

export type MovementEditData = {
  edit: MovementEditContext
  categories: CategoryWithSubcategories[]
  /** The user's household (when it has two members) — enables the share toggle. */
  household: Household | null
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
    getTransactionDetail(supabase, txId),
    getAllCategories(supabase),
  ])
  if (!transaction) return null

  const isParent = transaction.is_parent === true
  const isInstallmentChild = !isParent && transaction.parent_id != null
  if (!isParent && !transaction.account_id) return null
  // Reimbursements are not edited through this form — they use confirm/cancel.
  // Reimbursements and debt settlements are not edited via the movement form;
  // they are managed from their own flows (reintegros / Compartido).
  if (transaction.type === 'reimbursement' || transaction.type === 'settlement') return null

  // Installment parent (madre): account_id is NULL; resolve a child's card
  // account and whether any child is paid (locks the amount).
  let accountId: string
  let hasPaidInstallment = false
  let cardName: string | null = null
  if (isParent) {
    const family = await getInstallmentFamily(supabase, transaction.id)
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
    isInstallmentChild,
  })

  // Available balance of the movement's own account, in the movement currency,
  // for the soft negative-balance warning. Parents (credit, off-ledger) skip it.
  const ownerDetail = transaction.account_id
    ? await getAccountDetail(supabase, transaction.account_id)
    : null
  const availableBalance = ownerDetail?.balances[transaction.currency_code] ?? 0

  // Current shared state, to prefill the "Compartir gasto" toggle. We resolve
  // the first household member's percentage from the stored splits. For an
  // installment purchase the splits live on the child cuotas (all share the same
  // percentages), so we read them from the first child instead of the parent.
  let shared: { householdId: string; firstPct: number } | null = null
  if (transaction.is_shared && transaction.household_id) {
    let splitTxId = transaction.id
    if (isParent) {
      const { data: firstChild } = await supabase
        .from('transactions')
        .select('id')
        .eq('parent_id', transaction.id)
        .eq('is_parent', false)
        .order('installment_n', { ascending: true })
        .limit(1)
        .maybeSingle()
      splitTxId = firstChild?.id ?? transaction.id
    }
    const { data: splits } = await supabase
      .from('shared_expense_split')
      .select('user_id, percentage')
      .eq('transaction_id', splitTxId)
    // members[0] in the form is always the current user, so prefill its share
    // from the current user's split row.
    const mine = splits?.find((s) => s.user_id === user.id)
    shared = { householdId: transaction.household_id, firstPct: mine?.percentage ?? 50 }
  }

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
    parentId: transaction.parent_id ?? null,
    sourceAccountName: isParent ? cardName : transaction.source_account?.name ?? null,
    destinationAccountName: transaction.destination_account?.name ?? null,
    editableFields,
    availableBalance,
    shared,
    returnHref,
  }

  // `household` is sourced client-side (the app-wide movement drawer) for the
  // edit drawer; the no-JS `/edit` page falls back to no share toggle.
  return { edit, categories, household: null }
}
