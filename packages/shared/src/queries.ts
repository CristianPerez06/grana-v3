import type { GranaSupabaseClient } from '@grana/supabase'
import {
  computeHouseholdBalances,
  deriveCurrentAccount,
  formatDateISO,
  gateSplit,
  getTodayAR,
  householdDebtAt,
  householdOutlook,
  type BalanceCurrency,
  type CurrentAccount,
  type DebtSettlement,
  type LedgerSettlement,
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

// ── Exhaustive paging ─────────────────────────────────────────────────────────

/** Rows per round-trip. Independent of the server's `max-rows`: the loop
 *  advances by what actually came back and stops on an empty page, so a smaller
 *  server cap costs extra round-trips but never truncates. */
const PAGE_SIZE = 1000

/**
 * Walk `.range()` until the set is exhausted. Every read of this module whose
 * product is a money number goes through here (spec `shared-data-access`): a
 * plain `.select()` is silently capped by PostgREST's server-side `max-rows` —
 * `error === null`, fewer rows than match, no signal for the caller — and a debt
 * derived from that is a plausible, wrong number. The `.order()` the caller
 * fixes is what makes the paging stable; without it pages can overlap or skip.
 *
 * An errored page THROWS instead of ending the walk. On error PostgREST returns
 * `data: null`, which is indistinguishable from "no more rows": treating it as
 * the end would reintroduce the exact silent truncation this helper exists to
 * prevent, only mid-set instead of at the ceiling.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; ) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    if (batch.length === 0) break
    rows.push(...batch)
    offset += batch.length
  }
  return rows
}

async function currentUserId(supabase: GranaSupabaseClient): Promise<string | null> {
  // Locally-verified claims (no network getUser): the id is only used to
  // filter own rows, which RLS already enforces.
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}

/** Full names of the caller's household members (including the caller), by user id.
 *
 * Goes through the `get_household_member_profiles` RPC rather than reading
 * `profiles` directly. RLS has no column granularity, so a policy that let a
 * member read their co-member's row exposed it whole — email included — and the
 * allowlist survived only because every call site remembered to enumerate
 * columns. Since 0055 the allowlist is the function's return signature, so there
 * is no `select` a caller could widen. */
async function householdMemberNames(
  supabase: GranaSupabaseClient,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc('get_household_member_profiles')
  return new Map((data ?? []).map((p) => [p.id, p.full_name]))
}

// ── getHousehold ──────────────────────────────────────────────────────────────

/** The current user's active household (members + default split), or null. */
export async function getHousehold(supabase: GranaSupabaseClient): Promise<Household | null> {
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

  const nameById = await householdMemberNames(supabase)

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
  supabase: GranaSupabaseClient,
  householdId: string,
): Promise<{ projectable: ProjectableSplit[]; settlements: SettlementRow[] }> {
  // Deterministic order: `unique (transaction_id, user_id)` (mig. 0023) makes
  // the pair a total order, so the pages can neither overlap nor skip.
  const splitRows = await fetchAllRows<{
    transaction_id: string
    user_id: string
    amount_assigned: number
  }>((from, to) =>
    supabase
      .from('shared_expense_split')
      .select('transaction_id, user_id, amount_assigned')
      .eq('household_id', householdId)
      .order('transaction_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, to),
  )

  // The movements are fetched by PREDICATE, not by a client-built id list. The
  // symmetric invariant of mig. 0048 (`is_shared = false` ⇒ no splits) makes the
  // two sets equivalent: every transaction carrying a split of this household
  // falls inside the predicate. It also brings rows with no splits of their own
  // (the installment PARENT), which is inert — `projectable` is built by walking
  // the SPLITS and looking the movement up, so a spare map entry contributes
  // nothing.
  //
  // Why not `.in('id', txIds)`: paging does not fix its second failure mode. A
  // long id list is serialised into the query string, and past a few thousand
  // uuids the URL crosses PostgREST's length limit and the request fails
  // outright — a ceiling independent of `max-rows`.
  const txRows = await fetchAllRows<{
    id: string
    user_id: string
    type: string
    is_shared: boolean
    currency_code: string
    date: string
    due_date: string | null
    received_at: string | null
    cancelled_at: string | null
    description: string | null
    linked_transaction_id: string | null
    category: { name: string } | null
  }>((from, to) =>
    supabase
      .from('transactions')
      .select(
        'id, user_id, type, is_shared, currency_code, date, due_date, received_at, cancelled_at, description, linked_transaction_id, category:categories(name)',
      )
      .eq('household_id', householdId)
      .eq('is_shared', true)
      // The PK is a total order and the cheapest stable one. Unlike
      // `getAccountMovementsAscending`, this consumer does not want chronological
      // rows — `deriveCurrentAccount` sorts by impact date itself; the order here
      // only has to be stable.
      .order('id', { ascending: true })
      .range(from, to),
  )

  const txById = new Map(
    txRows.map((t) => [
      t.id,
      {
        user_id: t.user_id,
        type: t.type,
        is_shared: t.is_shared,
        currency_code: t.currency_code,
        date: t.date,
        due_date: t.due_date,
        received_at: t.received_at,
        cancelled_at: t.cancelled_at,
        description: t.description,
        category: (t.category as unknown as { name: string } | null) ?? null,
        linked_transaction_id: t.linked_transaction_id,
      },
    ]),
  )

  // Reimbursements carry no description/category of their own — resolve a label
  // from the expense they offset (linked_transaction_id), like getSharedExpenses.
  // The offset expense is itself a shared movement of this household, so it is
  // already in `txById`; the residual read below covers only ids that are not,
  // and is expected to stay empty (it costs no round-trip when it is).
  const linkedLabelById = new Map<string, string>()
  const labelOf = (t: { description: string | null; category: { name: string } | null }) =>
    t.description ?? t.category?.name ?? null

  const missingLinkedIds: string[] = []
  for (const t of txById.values()) {
    if (t.type !== 'reimbursement' || !t.linked_transaction_id) continue
    const target = txById.get(t.linked_transaction_id)
    if (target) {
      const label = labelOf(target)
      if (label) linkedLabelById.set(t.linked_transaction_id, label)
    } else {
      missingLinkedIds.push(t.linked_transaction_id)
    }
  }

  if (missingLinkedIds.length) {
    const linked = await fetchAllRows<{
      id: string
      description: string | null
      category: { name: string } | null
    }>((from, to) =>
      supabase
        .from('transactions')
        .select('id, description, category:categories(name)')
        .in('id', [...new Set(missingLinkedIds)])
        .order('id', { ascending: true })
        .range(from, to),
    )
    for (const e of linked) {
      const label = labelOf({
        description: e.description,
        category: (e.category as unknown as { name: string } | null) ?? null,
      })
      if (label) linkedLabelById.set(e.id, label)
    }
  }

  const projectable: ProjectableSplit[] = (splitRows ?? []).flatMap((row) => {
    const tx = txById.get(row.transaction_id)
    // Defensive: only splits of a still-shared transaction feed the derived debt.
    // A stray/legacy split on an unshared movement (its own household_id survives)
    // must never contribute — the symmetric invariant should prevent it, this is the
    // belt-and-suspenders on the read side.
    if (!tx || !tx.is_shared || !isBalanceCurrency(tx.currency_code)) return []
    const kind = tx.type === 'reimbursement' ? 'reimbursement' : 'expense'
    const linkedLabel = tx.linked_transaction_id
      ? linkedLabelById.get(tx.linked_transaction_id)
      : undefined
    const label =
      kind === 'reimbursement'
        ? linkedLabel
          ? `Reintegro · ${linkedLabel}`
          : 'Reintegro'
        : (tx.description ?? tx.category?.name ?? 'Gasto compartido')
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
        date: tx.date,
      },
    ]
  })

  // Fetched ONCE, with the rich columns, and projected per consumer below.
  // `getCurrentAccount` used to read this table a second time for `id`/`status`/
  // dates: besides the extra round-trip, two unordered reads of the same table
  // could disagree about which rows they saw.
  const settlements = await fetchAllRows<SettlementRow>((from, to) =>
    supabase
      .from('settlement')
      .select('id, payer_id, receiver_id, amount, currency_code, status, created_at, resolved_at')
      .eq('household_id', householdId)
      .order('id', { ascending: true })
      .range(from, to),
  )

  return { projectable, settlements }
}

/** A settlement as stored, before either consumer's projection. */
type SettlementRow = {
  id: string
  payer_id: string
  receiver_id: string
  amount: number
  currency_code: string
  status: string
  created_at: string
  resolved_at: string | null
}

/** Projection for the debt math: amount + direction, always counting. */
function toDebtSettlements(rows: SettlementRow[]): DebtSettlement[] {
  return rows.flatMap((s) =>
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
}

/** Projection for the ledger: carries id, date and status so the extracto can
 *  render each entry and offer the revert action. */
function toLedgerSettlements(rows: SettlementRow[]): LedgerSettlement[] {
  return rows.flatMap((s) => {
    if (!isBalanceCurrency(s.currency_code)) return []
    const status: LedgerSettlement['status'] =
      s.status === 'pending_receipt'
        ? 'pending'
        : s.status === 'completed'
          ? 'completed'
          : (s.status as LedgerSettlement['status']) // 'reversed' | 'contra' (Fase B)
    return [
      {
        currencyCode: s.currency_code,
        id: s.id,
        // Full timestamp (not sliced) so a settlement sorts AFTER same-day
        // expenses (which carry date-only) → the latest one shows on top.
        date: s.resolved_at ?? s.created_at,
        payerId: s.payer_id,
        receiverId: s.receiver_id,
        amount: s.amount,
        status,
      },
    ]
  })
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
  supabase: GranaSupabaseClient,
  asOf?: string,
): Promise<DebtByCurrency | null> {
  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) return null

  const ref = asOf ?? formatDateISO(getTodayAR())
  const { projectable, settlements } = await collectDebtInputs(supabase, household.id)
  const debtSettlements = toDebtSettlements(settlements)
  const [a, b] = household.members.map((m) => m.userId)

  const result = {} as DebtByCurrency
  for (const currency of CURRENCIES) {
    result[currency] = householdDebtAt(projectable, debtSettlements, currency, ref, a, b)
  }
  return result
}

// ── getHouseholdOutlook ─────────────────────────────────────────────────────

/** Per-month projection of what enters the debt in the next `monthsAhead`
 *  months, per currency. The current user is member A. */
export async function getHouseholdOutlook(
  supabase: GranaSupabaseClient,
  monthsAhead = 3,
): Promise<Record<BalanceCurrency, OutlookMonth[]> | null> {
  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) return null

  const today = formatDateISO(getTodayAR())
  const { projectable, settlements } = await collectDebtInputs(supabase, household.id)
  const debtSettlements = toDebtSettlements(settlements)
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
        debtSettlements,
        currency,
      )[a] ?? 0
    result[currency] = householdOutlook(
      projectable,
      debtSettlements,
      currency,
      asOfByMonth,
      a,
      baseline,
    )
  }
  return result
}

// ── getCurrentAccount (cuenta corriente) ──────────────────────────────────────

export type CurrentAccountData = {
  byCurrency: Record<BalanceCurrency, CurrentAccount>
  /** "Lo que se viene" — same projection as the home, per currency. */
  outlook: Record<BalanceCurrency, OutlookMonth[]> | null
  /** Current user (member A — the perspective of the ledger). */
  memberAId: string
  partnerName: string
  nameById: Record<string, string>
}

/**
 * The household current account (cuenta corriente) at today, per currency: the
 * derived ledger (extracto + ecuación + saldo) plus the forward projection. The
 * ledger derivation is pure (`deriveCurrentAccount`); here we only gather inputs.
 */
export async function getCurrentAccount(supabase: GranaSupabaseClient): Promise<CurrentAccountData | null> {
  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) return null

  const userId = await currentUserId(supabase)
  const ids = household.members.map((m) => m.userId)
  const a = userId && ids.includes(userId) ? userId : ids[0]
  const b = ids.find((id) => id !== a) ?? ids[0]
  const nameById = Object.fromEntries(household.members.map((m) => [m.userId, m.fullName]))
  const partnerName = nameById[b] ?? ''

  const today = formatDateISO(getTodayAR())
  const { projectable, settlements } = await collectDebtInputs(supabase, household.id)

  // Ledger settlements carry id/date/status (richer than the debt's
  // DebtSettlement) — same rows `collectDebtInputs` already fetched, projected.
  const ledgerSettlements = toLedgerSettlements(settlements)

  const byCurrency = {} as Record<BalanceCurrency, CurrentAccount>
  for (const currency of CURRENCIES) {
    byCurrency[currency] = deriveCurrentAccount(projectable, ledgerSettlements, currency, today, a, b)
  }

  const outlook = await getHouseholdOutlook(supabase)

  return { byCurrency, outlook, memberAId: a, partnerName, nameById }
}

// ── getPendingSettlements ─────────────────────────────────────────────────────

/** Settlements awaiting the current user (receiver) to assign an account. */
export async function getPendingSettlements(supabase: GranaSupabaseClient): Promise<PendingSettlement[]> {
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const { data } = await supabase
    .from('settlement')
    .select('id, amount, currency_code, payer_id')
    .eq('receiver_id', userId)
    .eq('status', 'pending_receipt')
  if (!data?.length) return []

  // Every payer is a member of the caller's household, so the RPC covers them.
  const nameById = await householdMemberNames(supabase)

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

// ── getSharedAccruedExpenses (DEVENGADO) ──────────────────────────────────────

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
type TaxonomyHandle = { name: string; canonical_name: string; user_id: string | null } | null

/** Accrual-scoped expense row, as selected by `getSharedAccruedMovements`. */
type ExpRow = {
  id: string
  type: string
  description: string | null
  date: string
  due_date: string | null
  amount: number
  currency_code: string
  user_id: string
  installments_total: number | null
  category: CategoryHandle
  subcategory: TaxonomyHandle
}

/** Received shared reimbursement row (feeds the NET). */
type ReimbRow = {
  id: string
  description: string | null
  date: string
  due_date: string | null
  amount: number
  currency_code: string
  user_id: string
}

/**
 * Shared movements of the household scoped by **DEVENGADO** (accrual): EXPENSES
 * counted by purchase `date` (each installment CHILD in its month; the PARENT
 * excluded — off-ledger), plus **received REIMBURSEMENTS** by their date. Mirrors
 * the dashboard's accrual scoping so Compartido cuenta igual que el resto de la
 * app, summing the **household total** (`amount`, both parts). Feeds "Gastaron
 * juntos" (gross, expenses), the category breakdown (expenses only) and the NET
 * (gross − reintegros). Both currencies.
 *
 * NOTE: the DEBT (cuenta corriente) keeps its own IMPACT clock — see
 * `getHouseholdDebt`/`getHouseholdOutlook`. This is the spending clock only.
 */
export async function getSharedAccruedMovements(
  supabase: GranaSupabaseClient,
  month: string,
): Promise<SharedExpenseItem[]> {
  const userId = await currentUserId(supabase)
  if (!userId) return []

  const household = await getHousehold(supabase)
  if (!household) return []

  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

  // Both reads keep their `[start, end)` month window — narrowing by a domain
  // predicate is compatible with "complete by construction". What is not is
  // TRUNCATING inside that window, which the previous `.limit(500)` did: past
  // 500 movements in a month "Gastaron juntos" and the NET silently undercounted.
  const [expTxs, reimbTxs] = await Promise.all([
    // Expenses: `is_parent = false` → singles, card consumos and each cuota by its date.
    fetchAllRows<ExpRow>((from, to) =>
      supabase
        .from('transactions')
        .select(
          'id, type, description, date, due_date, amount, currency_code, user_id, installments_total, category:categories(id, name, canonical_name, user_id, icon, color), subcategory:subcategories(name, canonical_name, user_id)',
        )
        .eq('household_id', household.id)
        .eq('is_shared', true)
        .eq('type', 'expense')
        .eq('is_parent', false)
        .gte('date', start)
        .lt('date', end)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    // Received, non-cancelled shared reimbursements by their date (for the NET).
    fetchAllRows<ReimbRow>((from, to) =>
      supabase
        .from('transactions')
        .select('id, description, date, due_date, amount, currency_code, user_id')
        .eq('household_id', household.id)
        .eq('is_shared', true)
        .eq('type', 'reimbursement')
        .not('received_at', 'is', null)
        .is('cancelled_at', null)
        .gte('date', start)
        .lt('date', end)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ])
  if (!expTxs.length && !reimbTxs.length) return []

  // The current user's share (for "tu parte"); each row carries its own split.
  // One split row per movement, so this set is as large as the month's movements
  // — it used to be able to land on exactly `max-rows` and truncate "tu parte".
  const ids = [...expTxs, ...reimbTxs].map((t) => t.id)
  const shareByTx = new Map<string, number>()
  if (ids.length) {
    const rows = await fetchAllRows<{ transaction_id: string; amount_assigned: number }>(
      (from, to) =>
        supabase
          .from('shared_expense_split')
          .select('transaction_id, amount_assigned')
          .in('transaction_id', ids)
          .eq('user_id', userId)
          .order('transaction_id', { ascending: true })
          .range(from, to),
    )
    for (const r of rows) shareByTx.set(r.transaction_id, Number(r.amount_assigned))
  }

  const nameById = new Map(household.members.map((mm) => [mm.userId, mm.fullName]))

  const expenseItems: SharedExpenseItem[] = expTxs.flatMap((t) => {
    if (!isBalanceCurrency(t.currency_code)) return []
    const category = (t.category as unknown as CategoryHandle) ?? null
    const subcategory = (t.subcategory as unknown as TaxonomyHandle) ?? null
    return [
      {
        id: t.id,
        kind: 'expense' as const,
        reimbursementState: null,
        description: t.description,
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
        isInstallment: (t.installments_total ?? 1) > 1,
      },
    ]
  })

  const reimbItems: SharedExpenseItem[] = reimbTxs.flatMap((t) => {
    if (!isBalanceCurrency(t.currency_code)) return []
    return [
      {
        id: t.id,
        kind: 'reimbursement' as const,
        reimbursementState: 'received' as const,
        description: t.description,
        categoryId: null,
        categoryName: null,
        categoryCanonicalName: null,
        categoryIsSystem: false,
        categoryColor: null,
        categoryIcon: null,
        subcategoryName: null,
        subcategoryCanonicalName: null,
        subcategoryIsSystem: false,
        date: t.date,
        dueDate: t.due_date,
        amount: Number(t.amount),
        currencyCode: t.currency_code,
        payerId: t.user_id,
        payerName: nameById.get(t.user_id) ?? '',
        ownShare: shareByTx.get(t.id) ?? 0,
        isInstallment: false,
      },
    ]
  })

  return [...expenseItems, ...reimbItems]
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
  supabase: GranaSupabaseClient,
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
 * (settlements are not). Scoping:
 * - `month`: by registration `date` — the "recent movements" of that month.
 * - none: the latest `limit` movements.
 *
 * The DEVENGADO spending of the month ("Gastaron juntos" + breakdown) is NOT
 * served here — it has its own clock and grouping in `getSharedAccruedExpenses`.
 */
export async function getSharedExpenses(
  supabase: GranaSupabaseClient,
  opts: { limit?: number; month?: string } = {},
): Promise<SharedExpenseItem[]> {
  const { limit = 20, month } = opts
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
  if (month) {
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
