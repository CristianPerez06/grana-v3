import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { type RecurrenceFrequency } from './date'
import { decideRecurrenceInstance, type IntervalUnit } from './generator'
import {
  detectRecurrenceSuggestions,
  type RecurrenceSuggestion,
  type SuggestionMovement,
} from './suggestions'
import type {
  PendingRecurrenceInstance,
  Recurrence,
  RecurrenceDetail,
  RecurrenceInstance,
  RecurrenceStatus,
  RecurrenceSummary,
} from './types'

const RECURRENCE_SELECT = `
  *,
  account:accounts!recurrences_account_id_fkey(id, name, type),
  destination_account:accounts!recurrences_transfer_destination_account_id_fkey(id, name, type),
  category:categories(id, name, canonical_name, color, icon),
  subcategory:subcategories(id, name, canonical_name, category_id)
`

const INSTANCE_SELECT = `
  *,
  recurrence:recurrences(*),
  account:accounts!recurrence_instances_account_id_fkey(id, name, type),
  destination_account:accounts!recurrence_instances_transfer_destination_account_id_fkey(id, name, type),
  category:categories(id, name, canonical_name, color, icon),
  subcategory:subcategories(id, name, canonical_name, category_id)
`

type RecurrenceRow = Omit<RecurrenceSummary, 'pending_instance'>

function mapRecurrenceSummary(
  recurrence: RecurrenceRow,
  pendingByRecurrenceId: Map<string, RecurrenceInstance>,
): RecurrenceSummary {
  return {
    ...recurrence,
    pending_instance: pendingByRecurrenceId.get(recurrence.id) ?? null,
  }
}

async function getPendingInstancesByRecurrenceId(
  recurrenceIds: string[],
): Promise<Map<string, RecurrenceInstance>> {
  const pendingByRecurrenceId = new Map<string, RecurrenceInstance>()
  if (recurrenceIds.length === 0) return pendingByRecurrenceId

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurrence_instances')
    .select('*')
    .in('recurrence_id', recurrenceIds)
    .eq('status', 'pending')

  if (error) throw error

  for (const instance of (data ?? []) as RecurrenceInstance[]) {
    pendingByRecurrenceId.set(instance.recurrence_id, instance)
  }

  return pendingByRecurrenceId
}

export async function getRecurrences(
  options: { statuses?: RecurrenceStatus[] } = {},
): Promise<RecurrenceSummary[]> {
  const supabase = await createClient()
  const { statuses = ['active', 'paused'] } = options

  let query = supabase
    .from('recurrences')
    .select(RECURRENCE_SELECT)
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (statuses.length > 0) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query
  if (error) throw error

  const recurrences = (data ?? []) as RecurrenceRow[]
  const pendingByRecurrenceId = await getPendingInstancesByRecurrenceId(
    recurrences.map((recurrence) => recurrence.id),
  )

  return recurrences.map((recurrence) =>
    mapRecurrenceSummary(recurrence, pendingByRecurrenceId),
  )
}

export async function getPendingRecurrenceInstances(): Promise<
  PendingRecurrenceInstance[]
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recurrence_instances')
    .select(INSTANCE_SELECT)
    .eq('status', 'pending')
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as PendingRecurrenceInstance[]
}

export async function getRecurrenceDetail(
  id: string,
): Promise<RecurrenceDetail | null> {
  const supabase = await createClient()

  const { data: recurrence, error: recurrenceError } = await supabase
    .from('recurrences')
    .select(RECURRENCE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (recurrenceError) throw recurrenceError
  if (!recurrence) return null

  const { data: instances, error: instancesError } = await supabase
    .from('recurrence_instances')
    .select(INSTANCE_SELECT)
    .eq('recurrence_id', id)
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (instancesError) throw instancesError

  const recurrenceSummary = mapRecurrenceSummary(
    recurrence as RecurrenceRow,
    new Map(
      ((instances ?? []) as PendingRecurrenceInstance[])
        .filter((instance) => instance.status === 'pending')
        .map((instance) => [instance.recurrence_id, instance]),
    ),
  )

  return {
    ...recurrenceSummary,
    instances: ((instances ?? []) as PendingRecurrenceInstance[]).map((instance) => ({
      ...instance,
      recurrence: recurrence as Recurrence,
    })),
  }
}

// Devuelve el set de IDs de transacciones que fueron generadas por una regla
// recurrente — pensado para marcar movimientos en listados con un ícono.

export async function getRecurrenceLinkedTransactionIds(
  transactionIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>()
  if (transactionIds.length === 0) return ids

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurrence_instances')
    .select('confirmed_transaction_id')
    .in('confirmed_transaction_id', transactionIds)

  if (error || !data) return ids

  for (const row of data) {
    if (row.confirmed_transaction_id) ids.add(row.confirmed_transaction_id)
  }
  return ids
}

// Devuelve los datos mínimos de la regla que originó una transacción confirmada,
// o null si la transacción no proviene de una recurrencia.

export async function getRecurrenceLinkForTransaction(
  transactionId: string,
): Promise<{
  recurrence_id: string
  movement_type: string
  frequency: string
} | null> {
  const supabase = await createClient()

  const { data: instance, error } = await supabase
    .from('recurrence_instances')
    .select(`
      recurrence_id,
      recurrence:recurrences!inner(movement_type, frequency)
    `)
    .eq('confirmed_transaction_id', transactionId)
    .maybeSingle()

  if (error || !instance) return null

  const recurrence = (instance as unknown as {
    recurrence: { movement_type: string; frequency: string }
  }).recurrence

  return {
    recurrence_id: instance.recurrence_id as string,
    movement_type: recurrence.movement_type,
    frequency: recurrence.frequency,
  }
}

// ── 4.4: generateDueRecurrenceInstances ───────────────────────────────────────
// Lazy generator. Called from server components (e.g. /transactions page load).
// Idempotent: the unique partial index on (recurrence_id) WHERE status='pending'
// guarantees no double-insert under race conditions; we swallow that error.
// Generates AT MOST one pending instance per rule per call — matches the design
// rule "one pending per rule at a time".

type RecurrenceRuleForGeneration = {
  id: string
  frequency: RecurrenceFrequency
  interval_count: number
  interval_unit: IntervalUnit
  max_occurrences: number | null
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  amount: number
  account_id: string
  transfer_destination_account_id: string | null
  currency_code: string
  category_id: string | null
  subcategory_id: string | null
  description: string | null
}

export async function generateDueRecurrenceInstances(): Promise<{
  created: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { created: 0 }

  const today = formatDateISO(getTodayAR())

  const { data: rules, error: rulesError } = await supabase
    .from('recurrences')
    .select(
      'id, frequency, interval_count, interval_unit, max_occurrences, start_date, end_date, last_generated_date, amount, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description',
    )
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (rulesError || !rules || rules.length === 0) return { created: 0 }

  const typedRules = rules as RecurrenceRuleForGeneration[]
  const ruleIds = typedRules.map((rule) => rule.id)

  // Fetch every instance (any status) for these rules so we can: (a) skip rules
  // that already have a pending instance, and (b) enforce `max_occurrences`.
  const { data: instances } = await supabase
    .from('recurrence_instances')
    .select('recurrence_id, status')
    .eq('user_id', user.id)
    .in('recurrence_id', ruleIds)

  const rulesWithPending = new Set<string>()
  const materializedByRule = new Map<string, number>()
  for (const row of instances ?? []) {
    const ruleId = row.recurrence_id as string
    materializedByRule.set(ruleId, (materializedByRule.get(ruleId) ?? 0) + 1)
    if (row.status === 'pending') rulesWithPending.add(ruleId)
  }

  let created = 0

  for (const rule of typedRules) {
    const decision = decideRecurrenceInstance(
      {
        start_date: rule.start_date,
        end_date: rule.end_date,
        last_generated_date: rule.last_generated_date,
        interval_count: rule.interval_count,
        interval_unit: rule.interval_unit,
        max_occurrences: rule.max_occurrences,
      },
      today,
      rulesWithPending.has(rule.id),
      materializedByRule.get(rule.id) ?? 0,
    )

    if (!decision.generate) continue

    const { error: insertError } = await supabase
      .from('recurrence_instances')
      .insert({
        recurrence_id: rule.id,
        user_id: user.id,
        scheduled_date: decision.scheduled_date,
        status: 'pending',
        amount: rule.amount,
        account_id: rule.account_id,
        transfer_destination_account_id: rule.transfer_destination_account_id,
        currency_code: rule.currency_code,
        category_id: rule.category_id,
        subcategory_id: rule.subcategory_id,
        description: rule.description,
      })

    if (!insertError) created += 1
    // Unique-index violation under concurrent calls is expected; ignore silently.
  }

  return { created }
}

// ── 4.11: getTopRecurrenceSuggestion ──────────────────────────────────────────
// Calculates suggestions on-the-fly (no persistence) and returns the strongest
// candidate. Looks back 6 months at confirmed transactions, excludes movements
// already linked to a recurrence, dismissed fingerprints, and streams that
// already have an active/paused rule.

function monthsAgoISO(months: number): string {
  const today = getTodayAR()
  const target = new Date(today.getFullYear(), today.getMonth() - months, today.getDate())
  return formatDateISO(target)
}

export async function getTopRecurrenceSuggestion(): Promise<
  (RecurrenceSuggestion & {
    account: { id: string; name: string; type: 'cash' | 'bank' | 'credit' } | null
    destination_account: { id: string; name: string; type: 'cash' | 'bank' | 'credit' } | null
    category: { id: string; name: string } | null
  })
  | null
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const sinceDate = monthsAgoISO(6)

  // 1) Recent eligible transactions (no installments, no adjustments).
  const { data: txs, error: txsError } = await supabase
    .from('transactions')
    .select(
      'id, type, account_id, transfer_destination_account_id, category_id, currency_code, amount, date, description',
    )
    .eq('user_id', user.id)
    .gte('date', sinceDate)
    .in('type', ['income', 'expense', 'transfer'])
    .eq('is_parent', false)
    .is('parent_id', null)
    .order('date', { ascending: true })

  if (txsError || !txs || txs.length === 0) return null

  // 2) Exclude transactions already linked to a recurrence (so we don't count
  //    a confirmed instance as evidence of a "new" pattern).
  const txIds = txs.map((t) => t.id as string)
  const { data: linked } = await supabase
    .from('recurrence_instances')
    .select('confirmed_transaction_id')
    .in('confirmed_transaction_id', txIds)

  const linkedIds = new Set(
    (linked ?? [])
      .map((row) => row.confirmed_transaction_id as string | null)
      .filter((id): id is string => !!id),
  )

  // 3) Active/paused rules — their streams should be excluded.
  const { data: rules } = await supabase
    .from('recurrences')
    .select(
      'movement_type, account_id, transfer_destination_account_id, category_id, currency_code',
    )
    .eq('user_id', user.id)
    .in('status', ['active', 'paused'])

  // 4) Dismissed fingerprints.
  const { data: dismissals } = await supabase
    .from('recurrence_suggestion_dismissals')
    .select('fingerprint')
    .eq('user_id', user.id)

  const dismissedFingerprints = new Set(
    (dismissals ?? []).map((row) => row.fingerprint as string),
  )

  const movements: SuggestionMovement[] = (txs as Array<{
    id: string
    type: 'income' | 'expense' | 'transfer'
    account_id: string | null
    transfer_destination_account_id: string | null
    category_id: string | null
    currency_code: string
    amount: number | string
    date: string
    description: string | null
  }>)
    .filter((t) => !linkedIds.has(t.id) && t.account_id != null)
    .map((t) => ({
      id: t.id,
      type: t.type,
      account_id: t.account_id as string,
      destination_account_id: t.transfer_destination_account_id,
      category_id: t.category_id,
      currency_code: t.currency_code,
      amount: typeof t.amount === 'string' ? Number(t.amount) : t.amount,
      date: t.date,
      description: t.description,
    }))

  const existingStreams = (rules ?? []).map((rule) => ({
    movement_type: rule.movement_type as 'income' | 'expense' | 'transfer',
    account_id: rule.account_id as string,
    destination_account_id: rule.transfer_destination_account_id as string | null,
    category_id: rule.category_id as string | null,
    currency_code: rule.currency_code as string,
  }))

  const suggestions = detectRecurrenceSuggestions(
    movements,
    dismissedFingerprints,
    existingStreams,
  )

  if (suggestions.length === 0) return null

  const top = suggestions[0]

  // 5) Enrich the top suggestion with account/category labels for UI.
  const accountIds = new Set<string>([top.account_id])
  if (top.destination_account_id) accountIds.add(top.destination_account_id)

  const [{ data: accounts }, { data: category }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type')
      .in('id', Array.from(accountIds)),
    top.category_id
      ? supabase
          .from('categories')
          .select('id, name')
          .eq('id', top.category_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const byId = new Map(
    (accounts ?? []).map((a) => [
      a.id as string,
      { id: a.id as string, name: a.name as string, type: a.type as 'cash' | 'bank' | 'credit' },
    ]),
  )

  return {
    ...top,
    account: byId.get(top.account_id) ?? null,
    destination_account: top.destination_account_id
      ? (byId.get(top.destination_account_id) ?? null)
      : null,
    category: category
      ? { id: category.id as string, name: category.name as string }
      : null,
  }
}
