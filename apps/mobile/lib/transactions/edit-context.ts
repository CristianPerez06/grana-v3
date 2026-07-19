import type { MovementEditContext } from '@grana/movement-form'
import { getEditableFields } from '@grana/money-logic'
import { getInstallmentFamily, getTransactionDetail } from '@grana/transactions'
import { getAccountDetail } from '@grana/accounts'
import { supabase } from '../supabase'

// Mobile mirror of web's `buildMovementEditContext` (`apps/web/lib/transactions/
// edit-context.ts`), narrowed to the `MovementEditContext` the shared
// `useMovementForm` edit mode consumes. Same extraction trigger as the other
// mobile mirrors (`getHousehold`, `getMovementSharedInfo`): the pure editability
// rule (`getEditableFields`) is already shared; only this I/O assembly duplicates
// — it folds into a `@grana/*` package if a second shared consumer forces it.
//
// The `/transactions/[txId]/edit` screen loads accounts/categories/household
// itself (mirror of `new.tsx`); this fn returns only the edit context. Returns
// null when the movement can't be edited through the form (missing, ajeno,
// reimbursement/settlement, or a parent without a resolvable account) so the
// screen renders its not-found state.
export async function buildMovementEditContext(
  txId: string,
): Promise<MovementEditContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const transaction = await getTransactionDetail(supabase, txId)
  if (!transaction) return null

  // Only the owner (payer) can edit. A shared movement is readable cross-user
  // (household RLS) but the mutation filters by user_id — without this gate the
  // other member would get the form and a confusing "not found" on save.
  if (transaction.user_id !== user.id) return null

  const isParent = transaction.is_parent === true
  const isInstallmentChild = !isParent && transaction.parent_id != null
  if (!isParent && !transaction.account_id) return null
  // Reimbursements and settlements are managed from their own flows, not here.
  // (This guard also narrows `transaction.type` to `MovementType` below.)
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

  // Current shared state, to prefill the "Compartir gasto" toggle. For an
  // installment purchase the splits live on the child cuotas (all share the same
  // percentages), so read them from the first child instead of the parent.
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

  // Linked reimbursement, to prefill the "Tiene reintegro" section. Prefer the
  // pending one (editable); fall back to a received/cancelled one for read-only
  // display. Only for reimbursement-editable movements.
  let reimbursement: MovementEditContext['reimbursement'] = null
  if (editableFields.reimbursement) {
    const { data: reimbs } = await supabase
      .from('transactions')
      .select(
        'id, amount, reimbursement_target, received_at, cancelled_at, account_id, card_period_id',
      )
      .eq('type', 'reimbursement')
      .eq('linked_transaction_id', transaction.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    const rows = reimbs ?? []
    const chosen =
      rows.find((r) => r.received_at == null && r.cancelled_at == null) ?? rows[0] ?? null
    if (chosen) {
      reimbursement = {
        id: chosen.id,
        status: chosen.cancelled_at ? 'cancelled' : chosen.received_at ? 'received' : 'pending',
        target: (chosen.reimbursement_target ?? 'account') as 'account' | 'statement',
        amount: Math.abs(chosen.amount),
        accountId: chosen.account_id ?? null,
        cardPeriodId: chosen.card_period_id ?? null,
      }
    }
  }

  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    accountId,
    destinationAccountId: transaction.transfer_destination_account_id,
    isParent,
    parentId: transaction.parent_id ?? null,
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
    sourceAccountName: isParent ? cardName : (transaction.source_account?.name ?? null),
    destinationAccountName: transaction.destination_account?.name ?? null,
    editableFields,
    availableBalance,
    shared,
    reimbursement,
  }
}
