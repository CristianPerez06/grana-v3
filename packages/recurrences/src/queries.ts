import type { GranaSupabaseClient } from '@grana/supabase'
import {
  detectRecurrenceSuggestions,
  formatDateISO,
  getNextExpectedOccurrence,
  getTodayAR,
  owedOccurrencesForRule,
  type IntervalUnit,
  type PauseInterval,
  type RecurrenceFrequency,
  type RecurrenceSuggestion,
  type ScheduleVersion,
  type SuggestionMovement,
} from '@grana/money-logic'
import {
  findDuplicateRules,
  type DuplicateCandidate,
  type DuplicateMatch,
  type ExistingRuleForDuplicateCheck,
} from './duplicates'
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
  category:categories(id, name, canonical_name, color, icon, user_id),
  subcategory:subcategories(id, name, canonical_name, category_id, user_id)
`

const INSTANCE_SELECT = `
  *,
  recurrence:recurrences(*),
  account:accounts!recurrence_instances_account_id_fkey(id, name, type),
  destination_account:accounts!recurrence_instances_transfer_destination_account_id_fkey(id, name, type),
  category:categories(id, name, canonical_name, color, icon, user_id),
  subcategory:subcategories(id, name, canonical_name, category_id, user_id)
`

type RecurrenceRow = Omit<RecurrenceSummary, 'pending_instance'>

function mapRecurrenceSummary(
  recurrence: RecurrenceRow,
  pendingByRecurrenceId: Map<string, RecurrenceInstance>,
  today: string,
): RecurrenceSummary {
  return {
    ...recurrence,
    pending_instance: pendingByRecurrenceId.get(recurrence.id) ?? null,
    // Calendar "próximo": next occurrence >= today AND after the rule's cursor
    // (last_generated_date — the last occurrence already confirmed/omitted or
    // seeded from a movement). Independent of the pending (due) instance, whose
    // date sits at <= today. See RecurrenceSummary.next_occurrence.
    next_occurrence: getNextExpectedOccurrence(
      {
        start_date: recurrence.start_date,
        end_date: recurrence.end_date,
        interval_count: recurrence.interval_count,
        interval_unit: recurrence.interval_unit as IntervalUnit,
        max_occurrences: recurrence.max_occurrences,
      },
      today,
      recurrence.last_generated_date,
    ),
  }
}

export async function getPendingInstancesByRecurrenceId(
  supabase: GranaSupabaseClient,
  recurrenceIds: string[],
): Promise<Map<string, RecurrenceInstance>> {
  const pendingByRecurrenceId = new Map<string, RecurrenceInstance>()
  if (recurrenceIds.length === 0) return pendingByRecurrenceId

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
  supabase: GranaSupabaseClient,
  options: { statuses?: RecurrenceStatus[] } = {},
): Promise<RecurrenceSummary[]> {
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

  const recurrences = (data ?? []) as unknown as RecurrenceRow[]
  const pendingByRecurrenceId = await getPendingInstancesByRecurrenceId(
    supabase,
    recurrences.map((recurrence) => recurrence.id),
  )

  const today = formatDateISO(getTodayAR())
  return recurrences.map((recurrence) =>
    mapRecurrenceSummary(recurrence, pendingByRecurrenceId, today),
  )
}

export async function getPendingRecurrenceInstances(
  supabase: GranaSupabaseClient,
): Promise<PendingRecurrenceInstance[]> {
  const { data, error } = await supabase
    .from('recurrence_instances')
    .select(INSTANCE_SELECT)
    .eq('status', 'pending')
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as unknown as PendingRecurrenceInstance[]
}

export async function getRecurrenceDetail(
  supabase: GranaSupabaseClient,
  id: string,
): Promise<RecurrenceDetail | null> {
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
    recurrence as unknown as RecurrenceRow,
    new Map(
      ((instances ?? []) as unknown as PendingRecurrenceInstance[])
        .filter((instance) => instance.status === 'pending')
        .map((instance) => [instance.recurrence_id, instance]),
    ),
    formatDateISO(getTodayAR()),
  )

  return {
    ...recurrenceSummary,
    instances: ((instances ?? []) as unknown as PendingRecurrenceInstance[]).map((instance) => ({
      ...instance,
      recurrence: recurrence as unknown as Recurrence,
    })),
  }
}

// Cuántas instancias recurrentes COMPARTIDAS están pendientes de confirmar.
// Liviano (head + count), RLS-scoped al usuario. Alimenta el teaser del módulo
// Compartido que avisa y linkea al hub (la acción de confirmar vive solo ahí).
export async function countPendingSharedRecurrenceInstances(
  supabase: GranaSupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from('recurrence_instances')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('household_id', 'is', null)
  return count ?? 0
}

// Devuelve el set de IDs de transacciones que fueron generadas por una regla
// recurrente — pensado para marcar movimientos en listados con un ícono.

export async function getRecurrenceLinkedTransactionIds(
  supabase: GranaSupabaseClient,
  transactionIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>()
  if (transactionIds.length === 0) return ids

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
  supabase: GranaSupabaseClient,
  transactionId: string,
): Promise<{
  recurrence_id: string
  movement_type: string
  frequency: string
} | null> {
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

// ── generateDueRecurrenceInstances ─────────────────────────────────────────────
// Lazy generator. Called from the platform shell (web page load, mobile hub
// focus). It materializes EVERY occurrence a rule is owed — not one — which is
// the fix for #96: an unresolved occurrence used to stop the rule forever.
//
// What it is owed is derived by `owedOccurrencesForRule`, from the rule's
// calendar over its schedule versions, minus its pause intervals, minus the
// occurrences that already exist in ANY state. Nothing here consults
// `last_generated_date`: a cursor that only advances when the user resolves
// something is precisely what broke.
//
// Idempotent: re-running it returns the same list minus what it just created,
// and the partial unique index on (recurrence_id, due_date) is the backstop
// under concurrent calls. Auth is resolved by the shell and the resolved
// `userId` is injected.

export type RecurrenceRuleForGeneration = {
  id: string
  frequency: RecurrenceFrequency
  interval_count: number
  interval_unit: IntervalUnit
  max_occurrences: number | null
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  reconstruct_from: string
  amount: number
  account_id: string
  transfer_destination_account_id: string | null
  currency_code: string
  category_id: string | null
  subcategory_id: string | null
  description: string | null
  household_id: string | null
  default_split: unknown
}

// Pure builder for the pending-instance row, so the snapshot rule (which fields
// carry over from the rule) is unit-testable without a live client. Mirrors how
// `amount` is copied; for shared rules it also propagates the household and
// snapshots `default_split` into the instance's `split`. The DB constraint pairs
// household_id with split, so both are set together or left null.
export function buildPendingInstanceInsert(
  rule: RecurrenceRuleForGeneration,
  userId: string,
  dueDate: string,
) {
  return {
    recurrence_id: rule.id,
    user_id: userId,
    // The occurrence identity, immutable from here on. `scheduled_date` carries
    // the same value only so old native clients keep working during the
    // transition (see 0064 §7); it is not read as the due date any more.
    due_date: dueDate,
    scheduled_date: dueDate,
    status: 'pending' as const,
    amount: rule.amount,
    account_id: rule.account_id,
    transfer_destination_account_id: rule.transfer_destination_account_id,
    currency_code: rule.currency_code,
    category_id: rule.category_id,
    subcategory_id: rule.subcategory_id,
    description: rule.description,
    household_id: rule.household_id,
    split: rule.household_id ? rule.default_split : null,
  }
}

/**
 * How many occurrences one run materializes. Twelve months of a daily rule are
 * ~365 rows: opening a screen must not fire hundreds of writes.
 */
export const RECONSTRUCTION_BATCH_SIZE = 50

/** How far back the automatic reconstruction reaches. Registering an older payment by hand is not affected. */
const RECONSTRUCTION_HORIZON_MONTHS = 12

export type GenerationResult = {
  created: number
  /**
   * Occurrences still owed after this run. Greater than zero means the UI must
   * say so AND offer to continue: a daily rule with a year of backlog is ~8
   * runs, and nobody is going to reopen the app eight times to see their own
   * history.
   */
  remaining: number
  /**
   * Set when the run could not materialize what it owed. The caller MUST tell
   * the difference between this and "nothing to review": showing an empty state
   * on a failure is the exact opposite claim (spec: a failed materialization is
   * not shown as "you are up to date").
   */
  error: string | null
}

function horizonStart(today: string): string {
  const date = new Date(
    Number(today.slice(0, 4)) - RECONSTRUCTION_HORIZON_MONTHS / 12,
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  )
  return formatDateISO(date)
}

/**
 * Pick this run's rows out of everything the rules are owed.
 *
 * Every rule's CURRENT occurrence — the most recent one already due — goes in,
 * always, even if that takes the run past the batch size. A cut that left out
 * what falls due today would reproduce the very defect this generator removes,
 * with another number. The rest of the budget is filled oldest-first, so the
 * backlog rebuilds in calendar order.
 */
export function selectReconstructionBatch(
  owedByRule: Map<string, string[]>,
  batchSize: number = RECONSTRUCTION_BATCH_SIZE,
): Map<string, string[]> {
  const picked = new Map<string, string[]>()
  const rest: Array<{ ruleId: string; date: string }> = []

  for (const [ruleId, dates] of owedByRule) {
    if (dates.length === 0) continue
    const current = dates[dates.length - 1]
    picked.set(ruleId, [current])
    for (const date of dates.slice(0, -1)) rest.push({ ruleId, date })
  }

  let budget = batchSize - picked.size
  if (budget > 0) {
    rest.sort((a, b) => a.date.localeCompare(b.date))
    for (const { ruleId, date } of rest) {
      if (budget <= 0) break
      picked.get(ruleId)?.push(date)
      budget -= 1
    }
  }

  for (const dates of picked.values()) dates.sort()
  return picked
}

export async function generateDueRecurrenceInstances(
  supabase: GranaSupabaseClient,
  userId: string,
  options: {
    /**
     * The day the run treats as today. Defaults to the Argentine financial date;
     * pass it to keep a multi-run reconstruction anchored to one day, and to let
     * tests assert on fixed dates instead of on the clock.
     */
    today?: string
  } = {},
): Promise<GenerationResult> {
  const today = options.today ?? formatDateISO(getTodayAR())
  const horizon = horizonStart(today)

  const { data: rules, error: rulesError } = await supabase
    .from('recurrences')
    .select(
      'id, frequency, interval_count, interval_unit, max_occurrences, start_date, end_date, last_generated_date, reconstruct_from, amount, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description, household_id, default_split',
    )
    .eq('user_id', userId)
    .eq('status', 'active')

  if (rulesError) return { created: 0, remaining: 0, error: rulesError.message }
  if (!rules || rules.length === 0) return { created: 0, remaining: 0, error: null }

  const typedRules = rules as unknown as RecurrenceRuleForGeneration[]
  const ruleIds = typedRules.map((rule) => rule.id)

  // The three histories the calendar is composed from. A failure in any of them
  // is NOT recoverable by carrying on: walking today's schedule over a stretch
  // whose versions we failed to read would fabricate occurrences the rule never
  // produced, and ignoring pauses would bill a paused rule. Better no run than a
  // wrong one.
  const [versionsResult, pausesResult, instancesResult] = await Promise.all([
    supabase
      .from('recurrence_schedule_versions')
      .select('recurrence_id, effective_from, interval_count, interval_unit, anchor_date')
      .eq('user_id', userId)
      .in('recurrence_id', ruleIds),
    supabase
      .from('recurrence_pauses')
      .select('recurrence_id, paused_from, resumed_at')
      .eq('user_id', userId)
      .in('recurrence_id', ruleIds),
    // Every state, not just pending: what decides is that the occurrence EXISTS,
    // not how it ended. A skipped one must not come back and a confirmed one must
    // not be created twice.
    supabase
      .from('recurrence_instances')
      .select('recurrence_id, due_date')
      .eq('user_id', userId)
      .in('recurrence_id', ruleIds)
      .not('due_date', 'is', null),
  ])

  const readError = versionsResult.error ?? pausesResult.error ?? instancesResult.error
  if (readError) return { created: 0, remaining: 0, error: readError.message }

  const versionsByRule = new Map<string, ScheduleVersion[]>()
  for (const row of versionsResult.data ?? []) {
    const list = versionsByRule.get(row.recurrence_id as string) ?? []
    list.push({
      effective_from: row.effective_from as string,
      interval_count: row.interval_count as number,
      interval_unit: row.interval_unit as IntervalUnit,
      anchor_date: row.anchor_date as string,
    })
    versionsByRule.set(row.recurrence_id as string, list)
  }

  const pausesByRule = new Map<string, PauseInterval[]>()
  for (const row of pausesResult.data ?? []) {
    const list = pausesByRule.get(row.recurrence_id as string) ?? []
    list.push({
      paused_from: row.paused_from as string,
      resumed_at: row.resumed_at as string | null,
    })
    pausesByRule.set(row.recurrence_id as string, list)
  }

  const existingByRule = new Map<string, string[]>()
  for (const row of instancesResult.data ?? []) {
    const list = existingByRule.get(row.recurrence_id as string) ?? []
    list.push(row.due_date as string)
    existingByRule.set(row.recurrence_id as string, list)
  }

  const owedByRule = new Map<string, string[]>()
  let totalOwed = 0
  for (const rule of typedRules) {
    const owed = owedOccurrencesForRule({
      versions: versionsByRule.get(rule.id) ?? [],
      pauses: pausesByRule.get(rule.id) ?? [],
      endDate: rule.end_date,
      maxOccurrences: rule.max_occurrences,
      reconstructFrom: rule.reconstruct_from,
      horizon,
      today,
      existing: existingByRule.get(rule.id) ?? [],
    })
    if (owed.length === 0) continue
    owedByRule.set(rule.id, owed)
    totalOwed += owed.length
  }

  if (totalOwed === 0) return { created: 0, remaining: 0, error: null }

  const batch = selectReconstructionBatch(owedByRule)
  const rulesById = new Map(typedRules.map((rule) => [rule.id, rule]))
  const rows = [...batch.entries()].flatMap(([ruleId, dates]) => {
    const rule = rulesById.get(ruleId)
    return rule == null ? [] : dates.map((date) => buildPendingInstanceInsert(rule, userId, date))
  })

  const { created, error } = await insertReconstructedInstances(supabase, batch, rows, rulesById, userId)

  return { created, remaining: totalOwed - created, error }
}

/**
 * Write the batch, degrading only as far as the database forces.
 *
 * One statement is the healthy path. Until the activation migration drops
 * `recurrence_instances_one_pending_per_rule`, though, a rule owed more than one
 * occurrence violates that index — and a violation rejects the WHOLE statement,
 * so a single batch would materialize nothing at all. Hence the two fallbacks:
 * per rule, then the current occurrence alone. After activation neither fires,
 * and this collapses back to one insert per run with no flag to flip and no
 * deploy to coordinate.
 */
async function insertReconstructedInstances(
  supabase: GranaSupabaseClient,
  batch: Map<string, string[]>,
  rows: ReturnType<typeof buildPendingInstanceInsert>[],
  rulesById: Map<string, RecurrenceRuleForGeneration>,
  userId: string,
): Promise<{ created: number; error: string | null }> {
  if (rows.length === 0) return { created: 0, error: null }

  const { error: batchError } = await supabase
    .from('recurrence_instances')
    .insert(rows as never)
  if (!batchError) return { created: rows.length, error: null }

  let created = 0
  let lastError: string | null = null

  for (const [ruleId, dates] of batch) {
    const rule = rulesById.get(ruleId)
    if (rule == null) continue

    const { error: ruleError } = await supabase
      .from('recurrence_instances')
      .insert(dates.map((date) => buildPendingInstanceInsert(rule, userId, date)) as never)
    if (!ruleError) {
      created += dates.length
      continue
    }

    // The current occurrence is the one that must exist: without it the user is
    // looking at a screen that hides what falls due today.
    const current = dates[dates.length - 1]
    const { error: singleError } = await supabase
      .from('recurrence_instances')
      .insert(buildPendingInstanceInsert(rule, userId, current) as never)
    if (singleError) lastError = singleError.message
    else created += 1
  }

  // Only a run that created nothing at all is reported as a failure: a partial
  // run is the expected shape during the transition window, and the caller shows
  // what is left through `remaining`, not as an error.
  return { created, error: created === 0 ? (lastError ?? batchError.message) : null }
}

// ── getTopRecurrenceSuggestion ─────────────────────────────────────────────────
// Calculates suggestions on-the-fly (no persistence) and returns the strongest
// candidate. Looks back 6 months at confirmed transactions, excludes movements
// already linked to a recurrence, dismissed fingerprints, and streams that
// already have an active/paused rule. Auth resolved by the shell (injected userId).

function monthsAgoISO(months: number): string {
  const today = getTodayAR()
  const target = new Date(today.getFullYear(), today.getMonth() - months, today.getDate())
  return formatDateISO(target)
}

export async function getTopRecurrenceSuggestion(
  supabase: GranaSupabaseClient,
  userId: string,
): Promise<
  (RecurrenceSuggestion & {
    account: { id: string; name: string; type: 'cash' | 'bank' | 'credit' } | null
    destination_account: { id: string; name: string; type: 'cash' | 'bank' | 'credit' } | null
    category: { id: string; name: string; canonical_name: string; user_id: string | null } | null
    /**
     * How many suggestions are pending in total (this one included). The banner
     * shows one suggestion at a time — confirming/dismissing reveals the next —
     * and uses this count to decide whether to start collapsed (2+) or open (1).
     */
    total_pending: number
  })
  | null
> {
  const sinceDate = monthsAgoISO(6)

  // 1) Recent eligible transactions (no installments, no adjustments).
  const { data: txs, error: txsError } = await supabase
    .from('transactions')
    .select(
      'id, type, account_id, transfer_destination_account_id, category_id, currency_code, amount, date, description',
    )
    .eq('user_id', userId)
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
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])

  // 4) Dismissed fingerprints.
  const { data: dismissals } = await supabase
    .from('recurrence_suggestion_dismissals')
    .select('fingerprint')
    .eq('user_id', userId)

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
          .select('id, name, canonical_name, user_id')
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
    total_pending: suggestions.length,
    account: byId.get(top.account_id) ?? null,
    destination_account: top.destination_account_id
      ? (byId.get(top.destination_account_id) ?? null)
      : null,
    category: category
      ? {
          id: category.id as string,
          name: category.name as string,
          canonical_name: category.canonical_name as string,
          user_id: (category.user_id as string | null) ?? null,
        }
      : null,
  }
}

// ── Reglas duplicadas ─────────────────────────────────────────────────────────
// Lectura que alimenta el aviso no bloqueante de "ya tenés una regla así". Se
// consulta ANTES de confirmar el alta, no después: el objetivo es que el usuario
// no cree el duplicado, no enterarse cuando ya existe. Nunca bloquea (ver la
// nota sobre falsos positivos en `duplicates.ts`).

export async function getDuplicateRulesFor(
  supabase: GranaSupabaseClient,
  candidate: DuplicateCandidate,
  options: { excludeId?: string } = {},
): Promise<DuplicateMatch[]> {
  const { data, error } = await supabase
    .from('recurrences')
    .select(
      'id, status, description, account_id, currency_code, movement_type, amount, start_date, end_date, interval_count, interval_unit, max_occurrences, last_generated_date',
    )
    .eq('status', 'active')
  if (error) throw error

  const today = formatDateISO(getTodayAR())
  const rules = (data ?? []) as unknown as Array<
    ExistingRuleForDuplicateCheck & {
      start_date: string
      end_date: string | null
      interval_count: number
      interval_unit: IntervalUnit
      max_occurrences: number | null
      last_generated_date: string | null
    }
  >

  return findDuplicateRules(
    candidate,
    rules.map((rule) => ({
      ...rule,
      next_occurrence: getNextExpectedOccurrence(rule, today, rule.last_generated_date),
    })),
    options,
  )
}
