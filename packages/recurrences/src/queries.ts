import type { GranaSupabaseClient } from '@grana/supabase'
import {
  addInterval,
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

type RecurrenceRow = Omit<RecurrenceSummary, 'pending_instances'>

function mapRecurrenceSummary(
  recurrence: RecurrenceRow,
  pendingByRecurrenceId: Map<string, RecurrenceInstance[]>,
  today: string,
): RecurrenceSummary {
  return {
    ...recurrence,
    pending_instances: pendingByRecurrenceId.get(recurrence.id) ?? [],
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

/**
 * The unresolved occurrences of each rule, oldest first — ALL of them, not one.
 *
 * This used to return `Map<string, RecurrenceInstance>` and keep whichever row
 * arrived last, which was harmless only because the database allowed a single
 * pending per rule. With the backlog materialized that assumption silently drops
 * occurrences: the rule would look like it owes one thing while owing five.
 *
 * Paged to exhaustion over a unique order, for the same reason the generator's
 * reads are: PostgREST truncates at `db-max-rows` without saying so, and an
 * OFFSET window over a non-unique order can repeat or skip rows between pages.
 *
 * ORDERED BY `scheduled_date`, WHICH IS THE COLUMN THE SCREENS RENDER. Ordering
 * by `due_date` — the identity, and the more correct-sounding choice — sorts the
 * list by a date the user cannot see, and `due_date` is nullable for occurrences
 * resolved before 0064. `scheduled_date` is NOT NULL, so `(scheduled_date, id)`
 * is total with no null handling. When the enriched history ships and the screens
 * start showing the vencimiento itself, the sort moves with the display, not
 * before it.
 */
export async function getPendingInstancesByRecurrenceId(
  supabase: GranaSupabaseClient,
  recurrenceIds: string[],
): Promise<Map<string, RecurrenceInstance[]>> {
  const pendingByRecurrenceId = new Map<string, RecurrenceInstance[]>()
  if (recurrenceIds.length === 0) return pendingByRecurrenceId

  const { data, error } = await selectAllPages<RecurrenceInstance>(() =>
    supabase
      .from('recurrence_instances')
      .select('*')
      .in('recurrence_id', recurrenceIds)
      .eq('status', 'pending')
      .order('scheduled_date')
      .order('id'),
  )

  if (error) throw error

  for (const instance of data) {
    const list = pendingByRecurrenceId.get(instance.recurrence_id)
    if (list == null) pendingByRecurrenceId.set(instance.recurrence_id, [instance])
    else list.push(instance)
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

/**
 * Every unresolved occurrence the user has, oldest first — the feed behind the
 * "vencimientos por revisar" block.
 *
 * With one pending per rule this returned at most one row per rule and neither
 * paging nor a total order mattered. With the backlog materialized it is the list
 * itself, so both do. It sorts by `scheduled_date` — what the block renders — with
 * `id` making the order total, which is what keeps an OFFSET window from repeating
 * or skipping rows between pages.
 */
export async function getPendingRecurrenceInstances(
  supabase: GranaSupabaseClient,
): Promise<PendingRecurrenceInstance[]> {
  const { data, error } = await selectAllPages<PendingRecurrenceInstance>(() =>
    supabase
      .from('recurrence_instances')
      .select(INSTANCE_SELECT)
      .eq('status', 'pending')
      .order('scheduled_date')
      .order('id'),
  )

  if (error) throw error

  return data
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

  // Newest first for the history list, BY `scheduled_date` — the date the list
  // actually shows (`recurrence-instances-list.tsx`, `RecurrenceInstancesList.tsx`).
  // Sorting by `due_date` instead breaks the screen twice: it is null for every
  // occurrence resolved before 0064, and Postgres puts nulls FIRST in DESC, so
  // the history would open on the oldest rows ordered by little more than their
  // uuid; and for a resolved occurrence the two dates diverge, so an August
  // cuota paid on 15-Sep would sit below a September one paid on the 10th — sorted
  // by one date, displayed by another. `id` breaks ties so the OFFSET window the
  // paging uses cannot repeat or skip a row.
  const { data: instances, error: instancesError } = await selectAllPages<PendingRecurrenceInstance>(
    () =>
      supabase
        .from('recurrence_instances')
        .select(INSTANCE_SELECT)
        .eq('recurrence_id', id)
        .order('scheduled_date', { ascending: false })
        .order('id', { ascending: false }),
  )

  if (instancesError) throw instancesError

  const pending = instances
    .filter((instance) => instance.status === 'pending')
    // The query above orders newest-first for the history list; the unresolved
    // ones read oldest-first, which is the order they are reviewed in.
    .slice()
    .reverse()

  const recurrenceSummary = mapRecurrenceSummary(
    recurrence as unknown as RecurrenceRow,
    pending.length === 0 ? new Map() : new Map([[pending[0].recurrence_id, pending]]),
    formatDateISO(getTodayAR()),
  )

  return {
    ...recurrenceSummary,
    instances: instances.map((instance) => ({
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

/**
 * Twelve months back, INCLUSIVE, with end-of-month clamping.
 *
 * Built by hand this used to hand `new Date` a day that does not exist in the
 * target year: from `2028-02-29`, "same day, previous year" is `2027-02-29`,
 * which JavaScript rolls forward to `2027-03-01` — silently moving the horizon a
 * day late and dropping `2027-02-28` from a window the contract says includes it.
 * `addInterval` is the same month arithmetic the calendar walker uses, and it
 * clamps to the last valid day instead of rolling over.
 */
export function reconstructionHorizon(today: string): string {
  return addInterval(today, 'month', -RECONSTRUCTION_HORIZON_MONTHS)
}

/** What a run needs to know about one rule in order to prioritize it. */
export type RuleBacklog = {
  /** Dates the rule is owed, ascending. Never empty for a rule that is passed in. */
  owed: string[]
  /**
   * Newest occurrence the rule already has, in any state. Null when it has none.
   * Compared against the newest owed date, it answers the question the batch
   * turns on: is the rule's CURRENT occurrence materialized, or missing?
   */
  newestExisting: string | null
  /**
   * Whether the rule already has an unresolved occurrence. Until the activation
   * migration drops `recurrence_instances_one_pending_per_rule`, such a rule
   * CANNOT take another one, so spending budget on it starves rules that could
   * have been served.
   */
  hasPending: boolean
}

/**
 * Pick this run's rows out of everything the rules are owed.
 *
 * `batchSize` is a HARD limit: the run never writes more rows than that. An
 * earlier version let every rule's current occurrence through "even past the
 * budget", which with production's 61 rules would have made a declared batch of
 * 50 write 61 — the exact thing the batch exists to prevent. What the limit costs
 * is covered by continuation: whatever does not fit stays in `remaining`, and the
 * next run — the next screen the user opens, or the "continue" action — takes it.
 *
 * WHAT IT PRIORITIZES, and why it is not just "oldest date first". Ordering by
 * date alone starves rules across runs: with 61 rules and a batch of 50, the 50
 * served in run one come back to run two owing dates that are now OLDER than
 * before — their current occurrence was the newest thing they owed, and it just
 * got written — so they win again, and the other 11 never get in. That is #96's
 * shape between rules instead of within one, and it does not resolve itself.
 *
 * So the run is filled in three tiers:
 *
 *   1. rules whose CURRENT occurrence is missing AND that can take one —
 *      most overdue first. Serving one moves it out of this tier for good;
 *   2. rules whose current is missing but that already hold an unresolved
 *      occurrence. Until the activation these cannot take another, so they go
 *      after the rules that can actually be written. They are still attempted.
 *      The tier does NOT disappear once the index is dropped — `hasPending` goes
 *      on being true for exactly the same rules — but it stops costing anything:
 *      what disappears is the constraint that made their insert fail, so being
 *      second in line no longer means being skipped;
 *   3. the rest of the backlog, oldest first, so history rebuilds in order.
 */
export function selectReconstructionBatch(
  backlogByRule: Map<string, RuleBacklog>,
  batchSize: number = RECONSTRUCTION_BATCH_SIZE,
): Map<string, string[]> {
  const picked = new Map<string, string[]>()
  if (batchSize <= 0) return picked

  const servable: Array<{ ruleId: string; date: string }> = []
  const blocked: Array<{ ruleId: string; date: string }> = []
  const rest: Array<{ ruleId: string; date: string }> = []

  for (const [ruleId, backlog] of backlogByRule) {
    const { owed, newestExisting, hasPending } = backlog
    if (owed.length === 0) continue

    const current = owed[owed.length - 1]
    // The rule's current occurrence is materialized when something NEWER than
    // everything it is owed already exists. Otherwise the newest owed date is the
    // current one, and the rule has nothing standing in for today.
    const currentIsMissing = newestExisting == null || newestExisting < current

    if (currentIsMissing) {
      ;(hasPending ? blocked : servable).push({ ruleId, date: current })
      for (const date of owed.slice(0, -1)) rest.push({ ruleId, date })
    } else {
      for (const date of owed) rest.push({ ruleId, date })
    }
  }

  let budget = batchSize
  const take = (entries: Array<{ ruleId: string; date: string }>) => {
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.ruleId.localeCompare(b.ruleId))
    for (const { ruleId, date } of entries) {
      if (budget <= 0) return
      const dates = picked.get(ruleId)
      if (dates == null) picked.set(ruleId, [date])
      else dates.push(date)
      budget -= 1
    }
  }

  take(servable)
  take(blocked)
  take(rest)

  for (const dates of picked.values()) dates.sort()
  return picked
}

/**
 * PostgREST caps how many rows a request returns, silently. A truncated read of
 * the occurrences that already exist is not a slow generator: it is a generator
 * that believes dates are missing when they are not, and tries to create them
 * again. So every read the calendar depends on is paged to exhaustion.
 */
const READ_PAGE_SIZE = 1000

/** Refuses to spin forever if a server ignores the range window entirely. */
const MAX_READ_PAGES = 1000

async function selectAllPages<T>(
  build: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  },
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []

  // Every caller MUST order by a set of columns that is UNIQUE. `range` is an
  // OFFSET window, and Postgres makes no promise about how it breaks ties between
  // one request and the next: with a non-unique order, rows can repeat across
  // pages or be skipped entirely. A skipped pause is not a slower run — it is a
  // vencimiento fabricated for a period the rule was not running.
  //
  // Advance by what came back and stop on an EMPTY page, never on a short one.
  // A short page does not mean the end: PostgREST also truncates at its own
  // `db-max-rows`, which can be smaller than the window asked for, and reading
  // "fewer than requested" as "that was the last of them" is exactly the silent
  // cut this loop exists to survive.
  for (let page = 0; page < MAX_READ_PAGES; page += 1) {
    const { data, error } = await build().range(out.length, out.length + READ_PAGE_SIZE - 1)
    if (error) return { data: out, error }
    const rows = (data ?? []) as T[]
    if (rows.length === 0) return { data: out, error: null }
    out.push(...rows)
  }

  return {
    data: out,
    error: { message: 'La lectura de recurrencias no terminó: demasiadas páginas.' },
  }
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505'

type WriteError = { message: string; code?: string; details?: string }

const mentions = (error: WriteError, index: string) =>
  `${error.message} ${error.details ?? ''}`.includes(index)

/**
 * The single-pending index, alive until the activation migration drops it. A
 * violation of THIS one is the expected transition state: the rule is owed more
 * than one occurrence and the database still allows one.
 */
const isSinglePendingViolation = (error: WriteError | null) =>
  error != null &&
  error.code === UNIQUE_VIOLATION &&
  mentions(error, 'recurrence_instances_one_pending_per_rule')

/**
 * The occurrence identity index. A violation means somebody else already created
 * that exact occurrence — a second generator running concurrently, which is
 * normal — so the row is not ours to create and nothing is wrong.
 */
const isDuplicateOccurrence = (error: WriteError | null) =>
  error != null &&
  error.code === UNIQUE_VIOLATION &&
  mentions(error, 'recurrence_instances_one_per_rule_due_date')

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
  const horizon = reconstructionHorizon(today)

  const { data: rules, error: rulesError } = await selectAllPages<RecurrenceRuleForGeneration>(() =>
    supabase
      .from('recurrences')
      .select(
        'id, frequency, interval_count, interval_unit, max_occurrences, start_date, end_date, last_generated_date, reconstruct_from, amount, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description, household_id, default_split',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('id'),
  )

  if (rulesError) return { created: 0, remaining: 0, error: rulesError.message }
  if (rules.length === 0) return { created: 0, remaining: 0, error: null }

  const typedRules = rules
  const ruleIds = typedRules.map((rule) => rule.id)

  // Nothing older than this can ever be owed — an occurrence is filtered out if it
  // is before the horizon OR at/before its rule's floor — so it does not need
  // reading. The floor CAN sit before the horizon, which is why this is the
  // minimum of both and not just the horizon.
  const oldestFloor = typedRules.reduce(
    (oldest, rule) => (rule.reconstruct_from < oldest ? rule.reconstruct_from : oldest),
    horizon,
  )

  // The three histories the calendar is composed from. A failure in any of them
  // is NOT recoverable by carrying on: walking today's schedule over a stretch
  // whose versions we failed to read would fabricate occurrences the rule never
  // produced, and ignoring pauses would bill a paused rule. Better no run than a
  // wrong one. All three are paged to exhaustion, because a truncated page is not
  // a slow generator: it is a generator that thinks an occurrence is missing and
  // creates it again.
  const [versionsResult, pausesResult, instancesResult] = await Promise.all([
    selectAllPages<{
      recurrence_id: string
      effective_from: string
      interval_count: number
      interval_unit: string
      anchor_date: string
    }>(() =>
      supabase
        .from('recurrence_schedule_versions')
        .select('recurrence_id, effective_from, interval_count, interval_unit, anchor_date')
        .eq('user_id', userId)
        .in('recurrence_id', ruleIds)
        // Unique by `recurrence_schedule_versions_one_per_date`.
        .order('recurrence_id')
        .order('effective_from'),
    ),
    selectAllPages<{ recurrence_id: string; paused_from: string; resumed_at: string | null }>(() =>
      supabase
        .from('recurrence_pauses')
        .select('recurrence_id, paused_from, resumed_at')
        .eq('user_id', userId)
        .in('recurrence_id', ruleIds)
        // (recurrence_id, paused_from) is NOT unique — only ONE OPEN pause per
        // rule is enforced — so `id` is what makes the order total.
        .order('recurrence_id')
        .order('paused_from')
        .order('id'),
    ),
    // Every state, not just pending: what decides is that the occurrence EXISTS,
    // not how it ended. A skipped one must not come back and a confirmed one must
    // not be created twice.
    selectAllPages<{ recurrence_id: string; due_date: string; status: string }>(() =>
      supabase
        .from('recurrence_instances')
        .select('recurrence_id, due_date, status')
        .eq('user_id', userId)
        .in('recurrence_id', ruleIds)
        .not('due_date', 'is', null)
        .gte('due_date', oldestFloor)
        // Unique by `recurrence_instances_one_per_rule_due_date`.
        .order('due_date')
        .order('recurrence_id'),
    ),
  ])

  const readError = versionsResult.error ?? pausesResult.error ?? instancesResult.error
  if (readError) return { created: 0, remaining: 0, error: readError.message }

  const versionsByRule = new Map<string, ScheduleVersion[]>()
  for (const row of versionsResult.data) {
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
  for (const row of pausesResult.data) {
    const list = pausesByRule.get(row.recurrence_id as string) ?? []
    list.push({
      paused_from: row.paused_from as string,
      resumed_at: row.resumed_at as string | null,
    })
    pausesByRule.set(row.recurrence_id as string, list)
  }

  const existingByRule = new Map<string, { dates: string[]; newest: string | null; hasPending: boolean }>()
  for (const row of instancesResult.data) {
    const ruleId = row.recurrence_id as string
    const dueDate = row.due_date as string
    const entry = existingByRule.get(ruleId) ?? { dates: [], newest: null, hasPending: false }
    entry.dates.push(dueDate)
    if (entry.newest == null || dueDate > entry.newest) entry.newest = dueDate
    if (row.status === 'pending') entry.hasPending = true
    existingByRule.set(ruleId, entry)
  }

  const backlogByRule = new Map<string, RuleBacklog>()
  let totalOwed = 0
  for (const rule of typedRules) {
    const existing = existingByRule.get(rule.id)
    const owed = owedOccurrencesForRule({
      versions: versionsByRule.get(rule.id) ?? [],
      pauses: pausesByRule.get(rule.id) ?? [],
      endDate: rule.end_date,
      maxOccurrences: rule.max_occurrences,
      reconstructFrom: rule.reconstruct_from,
      horizon,
      today,
      existing: existing?.dates ?? [],
    })
    if (owed.length === 0) continue
    backlogByRule.set(rule.id, {
      owed,
      newestExisting: existing?.newest ?? null,
      hasPending: existing?.hasPending ?? false,
    })
    totalOwed += owed.length
  }

  if (totalOwed === 0) return { created: 0, remaining: 0, error: null }

  const batch = selectReconstructionBatch(backlogByRule)
  const rulesById = new Map(typedRules.map((rule) => [rule.id, rule]))
  const rows = [...batch.entries()].flatMap(([ruleId, dates]) => {
    const rule = rulesById.get(ruleId)
    return rule == null ? [] : dates.map((date) => buildPendingInstanceInsert(rule, userId, date))
  })

  const { created, error } = await insertReconstructedInstances(supabase, batch, rows, rulesById, userId)

  return { created, remaining: totalOwed - created, error }
}

/**
 * Write the batch, degrading ONLY as far as the database actually forces.
 *
 * One statement is the healthy path. Until the activation migration drops
 * `recurrence_instances_one_pending_per_rule`, a rule owed more than one
 * occurrence violates that index — and a violation rejects the WHOLE statement,
 * so a single batch would materialize nothing at all. Hence the two fallbacks:
 * per rule, then the current occurrence alone.
 *
 * The fallbacks fire on that violation and on NOTHING ELSE. An earlier version
 * retried on any failure, which turned a permission error, a constraint on the
 * payload or a dropped connection into "compatibility, carry on" — and if a later
 * insert happened to succeed, the run reported `error: null`. A failure the user
 * is not told about is the defect this generator exists to remove, one level up.
 *
 * A violation of the occurrence-identity index is a third case: it means a
 * concurrent run already created that occurrence. Nothing is wrong and nothing is
 * ours to create, so it counts as neither created nor failed.
 */
async function insertReconstructedInstances(
  supabase: GranaSupabaseClient,
  batch: Map<string, string[]>,
  rows: ReturnType<typeof buildPendingInstanceInsert>[],
  rulesById: Map<string, RecurrenceRuleForGeneration>,
  userId: string,
): Promise<{ created: number; error: string | null }> {
  if (rows.length === 0) return { created: 0, error: null }

  const insert = async (payload: unknown[]): Promise<WriteError | null> => {
    const { error } = await supabase.from('recurrence_instances').insert(payload as never)
    return (error as WriteError | null) ?? null
  }

  const batchError = await insert(rows)
  if (batchError == null) return { created: rows.length, error: null }

  // The batch is one statement, so its failure wrote nothing at all — whatever
  // the reason. Retrying rule by rule is therefore always safe, and it is what
  // keeps ONE bad rule from blocking every healthy one. The batch error itself is
  // not reported: the per-rule pass below is the authority on what actually
  // failed, and a rule that goes through on retry had no failure to report.
  let created = 0
  let failure: string | null = null

  for (const [ruleId, dates] of batch) {
    const rule = rulesById.get(ruleId)
    if (rule == null) continue

    const ruleError = await insert(
      dates.map((date) => buildPendingInstanceInsert(rule, userId, date)),
    )
    if (ruleError == null) {
      created += dates.length
      continue
    }
    if (isDuplicateOccurrence(ruleError)) continue
    if (!isSinglePendingViolation(ruleError)) {
      // Not the transition state: a real failure for this rule. Recorded, and the
      // run carries on so the other rules still get materialized.
      failure ??= ruleError.message
      continue
    }

    // The current occurrence is the one that must exist: without it the user is
    // looking at a screen that hides what falls due today.
    const current = dates[dates.length - 1]
    const singleError = await insert([buildPendingInstanceInsert(rule, userId, current)])
    if (singleError == null) created += 1
    else if (!isDuplicateOccurrence(singleError) && !isSinglePendingViolation(singleError)) {
      failure ??= singleError.message
    }
  }

  // Any unexpected failure is reported, even when other rules went through: a
  // partially failed run is still a failed run for the rules that failed, and
  // hiding it behind a non-zero `created` is how a silent error looks.
  return { created, error: failure }
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
