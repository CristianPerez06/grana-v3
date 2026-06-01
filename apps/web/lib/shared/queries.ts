import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import {
  computeHouseholdBalances,
  countsByPeriod,
  pairwiseDebt,
  type BalanceCurrency,
  type DebtMovementSplit,
  type DebtSettlement,
} from '@grana/money-logic'
import type {
  DebtByCurrency,
  Household,
  PendingSettlement,
  SharedExpenseItem,
} from './types'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']
const isBalanceCurrency = (c: string): c is BalanceCurrency => c === 'ARS' || c === 'USD'

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── getHousehold ──────────────────────────────────────────────────────────────

/** The current user's active household (members + default split), or null. */
export async function getHousehold(): Promise<Household | null> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return null

  const { data: membership } = await supabase
    .from('household_member')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: hh } = await supabase
    .from('household')
    .select('id, name, default_split, created_by, is_active')
    .eq('id', membership.household_id)
    .maybeSingle()
  if (!hh || !hh.is_active) return null

  const { data: members } = await supabase
    .from('household_member')
    .select('user_id')
    .eq('household_id', hh.id)
  const ids = (members ?? []).map((m) => m.user_id)

  // Co-member profiles are readable thanks to the 0024 profile-read policy.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids)
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const defaultSplit = Array.isArray(hh.default_split)
    ? (hh.default_split as { user_id: string; percentage: number }[])
    : []

  return {
    id: hh.id,
    name: hh.name,
    defaultSplit,
    members: ids.map((id) => ({
      userId: id,
      fullName: nameById.get(id) ?? '',
      isCreator: id === hh.created_by,
    })),
  }
}

// ── getHouseholdDebt ──────────────────────────────────────────────────────────

/** Net pairwise debt per currency, derived from splits + settlements. */
export async function getHouseholdDebt(): Promise<DebtByCurrency | null> {
  const household = await getHousehold()
  if (!household || household.members.length < 2) return null

  const supabase = await createClient()
  const today = formatDateISO(getTodayAR())

  const { data: splitRows } = await supabase
    .from('shared_expense_split')
    .select('transaction_id, user_id, amount_assigned')
    .eq('household_id', household.id)

  // Second query for the linked movements (avoids fragile PostgREST embeds —
  // same approach as attachLinkedExpenses in transactions/queries).
  const txIds = [...new Set((splitRows ?? []).map((r) => r.transaction_id))]
  const txById = new Map<
    string,
    {
      user_id: string
      type: string
      currency_code: string
      due_date: string | null
      received_at: string | null
      cancelled_at: string | null
    }
  >()
  if (txIds.length) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('id, user_id, type, currency_code, due_date, received_at, cancelled_at')
      .in('id', txIds)
    for (const t of txs ?? []) txById.set(t.id, t)
  }

  const splits: DebtMovementSplit[] = (splitRows ?? []).flatMap((row) => {
    const tx = txById.get(row.transaction_id)
    if (!tx || !isBalanceCurrency(tx.currency_code)) return []
    const kind = tx.type === 'reimbursement' ? 'reimbursement' : 'expense'
    const counts =
      kind === 'reimbursement'
        ? tx.received_at != null && tx.cancelled_at == null && countsByPeriod(tx.due_date, today)
        : countsByPeriod(tx.due_date, today)
    return [
      {
        currencyCode: tx.currency_code,
        memberId: row.user_id,
        movementOwnerId: tx.user_id,
        movementKind: kind,
        amountAssigned: row.amount_assigned,
        counts,
      },
    ]
  })

  const { data: settleRows } = await supabase
    .from('settlement')
    .select('payer_id, receiver_id, amount, currency_code')
    .eq('household_id', household.id)

  const settlements: DebtSettlement[] = (settleRows ?? []).flatMap((s) =>
    isBalanceCurrency(s.currency_code)
      ? [
          {
            currencyCode: s.currency_code,
            payerId: s.payer_id,
            receiverId: s.receiver_id,
            amount: s.amount,
            counts: true,
          },
        ]
      : [],
  )

  const [a, b] = household.members.map((m) => m.userId)
  const result = {} as DebtByCurrency
  for (const currency of CURRENCIES) {
    result[currency] = pairwiseDebt(computeHouseholdBalances(splits, settlements, currency), a, b)
  }
  return result
}

// ── getPendingSettlements ─────────────────────────────────────────────────────

/** Settlements awaiting the current user (receiver) to assign an account. */
export async function getPendingSettlements(): Promise<PendingSettlement[]> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const { data } = await supabase
    .from('settlement')
    .select('id, amount, currency_code, payer_id')
    .eq('receiver_id', userId)
    .eq('status', 'pending_receipt')
  if (!data?.length) return []

  const payerIds = [...new Set(data.map((s) => s.payer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', payerIds)
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  return data.flatMap((s) =>
    isBalanceCurrency(s.currency_code)
      ? [
          {
            id: s.id,
            amount: s.amount,
            currencyCode: s.currency_code,
            fromUserId: s.payer_id,
            fromName: nameById.get(s.payer_id) ?? '',
          },
        ]
      : [],
  )
}

// ── getMovementSharedInfo ─────────────────────────────────────────────────────

export type MovementSharedInfo = {
  ownShare: number
  bySplit: { userId: string; name: string; amount: number }[]
}

/**
 * Split info for a movement detail. For an installment parent it aggregates the
 * children's splits; for a simple/child movement it reads its own. Returns null
 * when the movement is not shared (or has no splits).
 */
export async function getMovementSharedInfo(
  transactionId: string,
  isParent: boolean,
): Promise<MovementSharedInfo | null> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return null

  let ids = [transactionId]
  if (isParent) {
    const { data: children } = await supabase
      .from('transactions')
      .select('id')
      .eq('parent_id', transactionId)
    ids = (children ?? []).map((c) => c.id)
  }
  if (!ids.length) return null

  const { data: splits } = await supabase
    .from('shared_expense_split')
    .select('user_id, amount_assigned')
    .in('transaction_id', ids)
  if (!splits?.length) return null

  const byUser = new Map<string, number>()
  for (const s of splits) {
    byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + Number(s.amount_assigned))
  }

  const household = await getHousehold()
  const nameById = new Map((household?.members ?? []).map((m) => [m.userId, m.fullName]))

  return {
    ownShare: byUser.get(userId) ?? 0,
    bySplit: [...byUser].map(([uid, amount]) => ({
      userId: uid,
      name: nameById.get(uid) ?? '',
      amount,
    })),
  }
}

// ── getSharedExpenses ─────────────────────────────────────────────────────────

/**
 * Recent shared expenses with this user's share. Installment children are
 * grouped under their parent (one row per purchase). Reimbursements and
 * settlements are excluded (they are not "expenses" in the list).
 */
export async function getSharedExpenses(limit = 20): Promise<SharedExpenseItem[]> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const household = await getHousehold()
  if (!household) return []

  // Shared expenses (installment parent or single) + shared reimbursements;
  // exclude installment children (parent_id set) so a purchase shows once.
  const { data: txs } = await supabase
    .from('transactions')
    .select(
      'id, type, description, date, amount, currency_code, user_id, is_parent, installments_total, linked_transaction_id, category:categories(name)',
    )
    .eq('household_id', household.id)
    .eq('is_shared', true)
    .in('type', ['expense', 'reimbursement'])
    .is('parent_id', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!txs?.length) return []

  // Reimbursements store no description/category of their own — derive both from
  // the linked expense so the row reads like its expense.
  const linkedIds = [
    ...new Set(
      txs
        .filter((t) => t.type === 'reimbursement' && t.linked_transaction_id)
        .map((t) => t.linked_transaction_id as string),
    ),
  ]
  const linkedById = new Map<string, { description: string | null; categoryName: string | null }>()
  if (linkedIds.length) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, description, category:categories(name)')
      .in('id', linkedIds)
    for (const e of linked ?? []) {
      linkedById.set(e.id, {
        description: e.description,
        categoryName: (e.category as { name: string } | null)?.name ?? null,
      })
    }
  }

  // This user's share lives on the transaction itself for cash/credit single
  // purchases; for an installment parent the splits live on the children, so we
  // sum the user's child shares.
  const parentIds = txs.filter((t) => t.is_parent).map((t) => t.id)
  const directIds = txs.filter((t) => !t.is_parent).map((t) => t.id)

  const shareByTx = new Map<string, number>()

  if (directIds.length) {
    const { data: rows } = await supabase
      .from('shared_expense_split')
      .select('transaction_id, amount_assigned')
      .in('transaction_id', directIds)
      .eq('user_id', userId)
    for (const r of rows ?? []) shareByTx.set(r.transaction_id, Number(r.amount_assigned))
  }

  if (parentIds.length) {
    const { data: children } = await supabase
      .from('transactions')
      .select('id, parent_id')
      .in('parent_id', parentIds)
    const childToParent = new Map((children ?? []).map((c) => [c.id, c.parent_id as string]))
    const childIds = [...childToParent.keys()]
    if (childIds.length) {
      const { data: rows } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .in('transaction_id', childIds)
        .eq('user_id', userId)
      for (const r of rows ?? []) {
        const parent = childToParent.get(r.transaction_id)
        if (!parent) continue
        shareByTx.set(parent, (shareByTx.get(parent) ?? 0) + Number(r.amount_assigned))
      }
    }
  }

  const nameById = new Map(household.members.map((m) => [m.userId, m.fullName]))

  return txs.flatMap((t) => {
    if (!isBalanceCurrency(t.currency_code)) return []
    const linked = t.linked_transaction_id ? linkedById.get(t.linked_transaction_id) : undefined
    const isReimbursement = t.type === 'reimbursement'
    return [
      {
        id: t.id,
        kind: isReimbursement ? ('reimbursement' as const) : ('expense' as const),
        description: isReimbursement ? linked?.description ?? null : t.description,
        categoryName: isReimbursement
          ? linked?.categoryName ?? null
          : (t.category as { name: string } | null)?.name ?? null,
        date: t.date,
        amount: Number(t.amount),
        currencyCode: t.currency_code,
        payerId: t.user_id,
        payerName: nameById.get(t.user_id) ?? '',
        ownShare: shareByTx.get(t.id) ?? 0,
        isInstallment: Boolean(t.is_parent),
      },
    ]
  })
}
