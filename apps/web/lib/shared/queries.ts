import type { DbClient } from '@/lib/supabase/db-client'
import { formatDateISO, getTodayAR } from '@/lib/date'
import {
  computeHouseholdBalances,
  gateSplit,
  householdDebtAt,
  householdOutlook,
  type BalanceCurrency,
  type DebtSettlement,
  type OutlookMonth,
  type ProjectableSplit,
} from '@grana/money-logic'
import type {
  DebtByCurrency,
  Household,
  PendingSettlement,
  SharedExpenseItem,
} from './types'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']
const isBalanceCurrency = (c: string): c is BalanceCurrency => c === 'ARS' || c === 'USD'

async function currentUserId(supabase: DbClient): Promise<string | null> {
  // Locally-verified claims (no network getUser): the id is only used to
  // filter own rows, which RLS already enforces.
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}

// ── getHousehold ──────────────────────────────────────────────────────────────

/** The current user's active household (members + default split), or null. */
export async function getHousehold(supabase: DbClient): Promise<Household | null> {
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

  // Current user first. The split UI (movement form, settings) treats
  // `members[0]` as "you" — it labels the editable share box and the "dividir
  // con {members[1]}" hint positionally. DB order is creation order, so without
  // this the member who joined second would see the other member's name in the
  // "you" slot. Debt/expense consumers key by user_id, so order is irrelevant
  // to them.
  const orderedIds = [userId, ...ids.filter((id) => id !== userId)]

  return {
    id: hh.id,
    name: hh.name,
    defaultSplit,
    members: orderedIds.map((id) => ({
      userId: id,
      fullName: nameById.get(id) ?? '',
      isCreator: id === hh.created_by,
    })),
  }
}

// ── Debt inputs (shared by debt + outlook) ──────────────────────────────────

/**
 * Fetch the household's shared splits and settlements in **projectable** form,
 * so the same dataset can be re-gated at any reference month (today's debt or a
 * future month's projection). Each movement gates on its OWN due date: an
 * expense by its statement/installment month, a reimbursement by when it is
 * received (a received "a cuenta" reimbursement counts now — it is real money
 * that already moved). The forward view is provided by the projection, not by
 * deferring impacted movements.
 */
async function collectDebtInputs(
  supabase: DbClient,
  householdId: string,
): Promise<{ projectable: ProjectableSplit[]; settlements: DebtSettlement[] }> {
  const { data: splitRows } = await supabase
    .from('shared_expense_split')
    .select('transaction_id, user_id, amount_assigned')
    .eq('household_id', householdId)

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
      description: string | null
      category: { name: string } | null
    }
  >()
  if (txIds.length) {
    const { data: txs } = await supabase
      .from('transactions')
      .select(
        'id, user_id, type, currency_code, due_date, received_at, cancelled_at, description, category:categories(name)',
      )
      .in('id', txIds)
    for (const t of txs ?? [])
      txById.set(t.id, {
        user_id: t.user_id,
        type: t.type,
        currency_code: t.currency_code,
        due_date: t.due_date,
        received_at: t.received_at,
        cancelled_at: t.cancelled_at,
        description: t.description,
        category: (t.category as unknown as { name: string } | null) ?? null,
      })
  }

  const projectable: ProjectableSplit[] = (splitRows ?? []).flatMap((row) => {
    const tx = txById.get(row.transaction_id)
    if (!tx || !isBalanceCurrency(tx.currency_code)) return []
    const kind = tx.type === 'reimbursement' ? 'reimbursement' : 'expense'
    const label =
      tx.description ?? tx.category?.name ?? (kind === 'reimbursement' ? 'Reintegro' : 'Gasto compartido')
    return [
      {
        currencyCode: tx.currency_code,
        memberId: row.user_id,
        movementOwnerId: tx.user_id,
        movementKind: kind,
        amountAssigned: row.amount_assigned,
        gateDueDate: tx.due_date,
        receivedAt: tx.received_at,
        cancelledAt: tx.cancelled_at,
        transactionId: row.transaction_id,
        label,
      },
    ]
  })

  const { data: settleRows } = await supabase
    .from('settlement')
    .select('payer_id, receiver_id, amount, currency_code')
    .eq('household_id', householdId)

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

  return { projectable, settlements }
}

/** Next `count` months after `fromYm` ('YYYY-MM'), as 'YYYY-MM' strings. */
function nextMonths(fromYm: string, count: number): string[] {
  let [y, m] = fromYm.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

// ── getHouseholdDebt ──────────────────────────────────────────────────────────

/** Net pairwise debt per currency, derived from splits + settlements, at `asOf`
 *  (defaults to today). */
export async function getHouseholdDebt(
  supabase: DbClient,
  asOf?: string,
): Promise<DebtByCurrency | null> {
  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) return null

  const ref = asOf ?? formatDateISO(getTodayAR())
  const { projectable, settlements } = await collectDebtInputs(supabase, household.id)
  const [a, b] = household.members.map((m) => m.userId)

  const result = {} as DebtByCurrency
  for (const currency of CURRENCIES) {
    result[currency] = householdDebtAt(projectable, settlements, currency, ref, a, b)
  }
  return result
}

// ── getHouseholdOutlook ─────────────────────────────────────────────────────

/** Per-month projection of what enters the debt in the next `monthsAhead`
 *  months, per currency. The current user is member A. */
export async function getHouseholdOutlook(
  supabase: DbClient,
  monthsAhead = 3,
): Promise<Record<BalanceCurrency, OutlookMonth[]> | null> {
  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) return null

  const today = formatDateISO(getTodayAR())
  const { projectable, settlements } = await collectDebtInputs(supabase, household.id)
  const userId = await currentUserId(supabase)
  // Member A is the current user when known, else creation order.
  const ids = household.members.map((m) => m.userId)
  const a = userId && ids.includes(userId) ? userId : ids[0]

  // A reference date inside each upcoming month — `countsByPeriod` compares only
  // the year-month, so the day is irrelevant (28 is safe for every month).
  const asOfByMonth = nextMonths(today.slice(0, 7), monthsAhead).map((month) => ({
    month,
    asOf: `${month}-28`,
  }))

  const result = {} as Record<BalanceCurrency, OutlookMonth[]>
  for (const currency of CURRENCIES) {
    const baseline =
      computeHouseholdBalances(
        projectable.map((s) => gateSplit(s, today)),
        settlements,
        currency,
      )[a] ?? 0
    result[currency] = householdOutlook(projectable, settlements, currency, asOfByMonth, a, baseline)
  }
  return result
}

// ── getPendingSettlements ─────────────────────────────────────────────────────

/** Settlements awaiting the current user (receiver) to assign an account. */
export async function getPendingSettlements(supabase: DbClient): Promise<PendingSettlement[]> {
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
  /** The OTHER members' shares (the current user is shown separately as "Tu parte"). */
  bySplit: { userId: string; name: string; amount: number }[]
}

/**
 * Split info for a movement detail. For an installment parent it aggregates the
 * children's splits; for a simple/child movement it reads its own. Returns null
 * when the movement is not shared (or has no splits).
 */
export async function getMovementSharedInfo(
  supabase: DbClient,
  transactionId: string,
  isParent: boolean,
): Promise<MovementSharedInfo | null> {
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

  const household = await getHousehold(supabase)
  const nameById = new Map((household?.members ?? []).map((m) => [m.userId, m.fullName]))

  return {
    ownShare: byUser.get(userId) ?? 0,
    // Exclude the current user: their share is surfaced separately as "Tu parte",
    // so listing them again by name would duplicate the figure.
    bySplit: [...byUser]
      .filter(([uid]) => uid !== userId)
      .map(([uid, amount]) => ({
        userId: uid,
        name: nameById.get(uid) ?? '',
        amount,
      })),
  }
}

// ── getSharedExpenses ─────────────────────────────────────────────────────────

/**
 * Shared expenses with this user's share. Installment children are grouped
 * under their parent (one row per purchase); shared reimbursements are included
 * (settlements are not). Scoping (limit lifted to feed totals/breakdown):
 * - `month`: by registration `date` — the "recent movements" of that month.
 * - `impactMonth`: by the month the expense IMPACTS — cash/debit by `date`, a
 *   card purchase by its statement `due_date`. Feeds "gastaron juntos" and the
 *   category breakdown, so a future card consumption does not count until paid.
 */
export async function getSharedExpenses(
  supabase: DbClient,
  opts: { limit?: number; month?: string; impactMonth?: string } = {},
): Promise<SharedExpenseItem[]> {
  const { limit = 20, month, impactMonth } = opts
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const household = await getHousehold(supabase)
  if (!household) return []

  const monthBounds = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    return {
      start: `${ym}-01`,
      end: m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`,
    }
  }

  // Shared expenses (installment parent or single) + shared reimbursements;
  // exclude installment children (parent_id set) so a purchase shows once.
  let query = supabase
    .from('transactions')
    .select(
      'id, type, description, date, due_date, amount, currency_code, user_id, is_parent, installments_total, linked_transaction_id, received_at, cancelled_at, category:categories(id, name, canonical_name, user_id, icon, color), subcategory:subcategories(name, canonical_name, user_id)',
    )
    .eq('household_id', household.id)
    .eq('is_shared', true)
    .in('type', ['expense', 'reimbursement'])
    .is('parent_id', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (impactMonth) {
    const { start, end } = monthBounds(impactMonth)
    // Impacts this month: a card statement due this month, OR a cash/debit
    // movement (no due date) dated this month.
    query = query
      .or(
        `and(due_date.gte.${start},due_date.lt.${end}),and(due_date.is.null,date.gte.${start},date.lt.${end})`,
      )
      .limit(500)
  } else if (month) {
    const { start, end } = monthBounds(month)
    query = query.gte('date', start).lt('date', end).limit(500)
  } else {
    query = query.limit(limit)
  }
  const { data: txs } = await query
  if (!txs?.length) return []

  // Reimbursements store no description/category/subcategory of their own —
  // derive all three from the linked expense so the row reads like its expense.
  const linkedIds = [
    ...new Set(
      txs
        .filter((t) => t.type === 'reimbursement' && t.linked_transaction_id)
        .map((t) => t.linked_transaction_id as string),
    ),
  ]
  type TaxonomyHandle = { name: string; canonical_name: string; user_id: string | null } | null
  type CategoryHandle =
    | {
        id: string
        name: string
        canonical_name: string
        user_id: string | null
        icon: string | null
        color: string | null
      }
    | null
  const linkedById = new Map<
    string,
    { description: string | null; category: CategoryHandle; subcategory: TaxonomyHandle }
  >()
  if (linkedIds.length) {
    const { data: linked } = await supabase
      .from('transactions')
      .select(
        'id, description, category:categories(id, name, canonical_name, user_id, icon, color), subcategory:subcategories(name, canonical_name, user_id)',
      )
      .in('id', linkedIds)
    for (const e of linked ?? []) {
      linkedById.set(e.id, {
        description: e.description,
        category: (e.category as unknown as CategoryHandle) ?? null,
        subcategory: (e.subcategory as TaxonomyHandle) ?? null,
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
    const category = isReimbursement
      ? linked?.category ?? null
      : ((t.category as unknown as CategoryHandle) ?? null)
    const subcategory = isReimbursement
      ? linked?.subcategory ?? null
      : ((t.subcategory as unknown as TaxonomyHandle) ?? null)
    return [
      {
        id: t.id,
        kind: isReimbursement ? ('reimbursement' as const) : ('expense' as const),
        reimbursementState: isReimbursement
          ? t.cancelled_at
            ? ('cancelled' as const)
            : t.received_at
              ? ('received' as const)
              : ('pending' as const)
          : null,
        description: isReimbursement ? linked?.description ?? null : t.description,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        categoryCanonicalName: category?.canonical_name ?? null,
        categoryIsSystem: category != null && category.user_id === null,
        categoryColor: category?.color ?? null,
        categoryIcon: category?.icon ?? null,
        subcategoryName: subcategory?.name ?? null,
        subcategoryCanonicalName: subcategory?.canonical_name ?? null,
        subcategoryIsSystem: subcategory != null && subcategory.user_id === null,
        date: t.date,
        dueDate: t.due_date,
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
