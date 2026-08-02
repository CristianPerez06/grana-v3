import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { getAccountDetail, getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getEditableFields } from '@grana/money-logic'
import { archivedTaxonomyFrom } from '@grana/movement-form'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import type { Household } from '@grana/shared'
import type {
  MovementEditContext,
  MovementFormAccount,
} from '@/lib/transactions/components/movement-form'

export type MovementEditData = {
  edit: MovementEditContext
  categories: CategoryWithSubcategories[]
  /** The user's household (when it has two members) — enables the share toggle. */
  household: Household | null
  /**
   * The account list the form needs — in edit mode the account is immutable
   * context, but the reimbursement "credit-to" select and the card `isCredit`
   * derivation still need the full list. Same projection the create drawer uses.
   */
  accounts: MovementFormAccount[]
}

type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

/** Project `getAccounts()` onto the form's account shape (mirrors the create loader). */
async function buildFormAccounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<MovementFormAccount[]> {
  const data = await getAccounts(supabase)
  return [
    ...[...data.cash, ...data.bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      balances: a.balances,
      institutionId: a.institution_id ?? null,
      institutionName: a.institution?.name ?? null,
      avatar: a.avatar,
    })),
    ...data.credit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
      balances: { ARS: 0, USD: 0 },
      institutionId: c.institution_id ?? null,
      institutionName: c.institution?.name ?? null,
      avatar: resolveAccountAvatar(
        { id: c.id, name: c.name, type: 'credit', color_key: c.color_key, icon_key: c.icon_key },
        c.institution,
      ),
    })),
  ]
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

  const [transaction, categories, accounts] = await Promise.all([
    getTransactionDetail(supabase, txId),
    getAllCategories(supabase),
    buildFormAccounts(supabase),
  ])
  if (!transaction) return null

  // A shared movement is READABLE cross-user (a member sees the household's shared
  // expenses via RLS), but only its owner (the payer) can edit it. Without this
  // gate the other member would get the edit form and a confusing "Transacción no
  // encontrada" on save (the mutation filters by user_id). Hide the affordance.
  if (transaction.user_id !== user.id) return null

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

  // Linked reimbursement, to prefill the "Tiene reintegro" section. Prefer the
  // pending one (editable); fall back to a received/cancelled one for read-only
  // display. For a madre the reimbursement links to the madre id (this txId), so
  // the same id resolves it. Only for reimbursement-editable movements.
  let reimbursement: MovementEditContext['reimbursement'] = null
  if (editableFields.reimbursement) {
    const { data: reimbs } = await supabase
      .from('transactions')
      .select('id, amount, reimbursement_target, received_at, cancelled_at, account_id, card_period_id')
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
    // Non-null only when this movement's classification was archived after
    // it was set: the catalog stops serving it, so the form needs the row
    // itself to keep showing (and not silently drop) the classification.
    archivedTaxonomy: archivedTaxonomyFrom(transaction),
    description: transaction.description,
    installmentsTotal: transaction.installments_total,
    parentId: transaction.parent_id ?? null,
    sourceAccountName: isParent ? cardName : transaction.source_account?.name ?? null,
    destinationAccountName: transaction.destination_account?.name ?? null,
    editableFields,
    availableBalance,
    shared,
    reimbursement,
    returnHref,
  }

  // `household` is sourced client-side (the app-wide movement drawer) for the
  // edit drawer; the no-JS `/edit` page falls back to no share toggle.
  return { edit, categories, household: null, accounts }
}
