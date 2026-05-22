// ─── Recurrence frequency primitives ─────────────────────────────────────────

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual'

function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return formatDateISO(date)
}

function addMonthsClamped(
  isoDate: string,
  monthsToAdd: number,
  options: { anchorDate?: string } = {},
): string {
  const date = parseISODate(isoDate)
  const sourceDay = options.anchorDate ? parseISODate(options.anchorDate).getDate() : date.getDate()
  const targetMonthIndex = date.getMonth() + monthsToAdd
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12)
  const normalizedTargetMonth = ((targetMonthIndex % 12) + 12) % 12
  const targetDay = Math.min(sourceDay, daysInMonth(targetYear, normalizedTargetMonth))

  return formatDateISO(new Date(targetYear, normalizedTargetMonth, targetDay))
}

export function getNextRecurrenceDate(
  fromDate: string,
  frequency: RecurrenceFrequency,
  options: { anchorDate?: string } = {},
): string {
  if (frequency === 'weekly') return addDays(fromDate, 7)
  if (frequency === 'biweekly') return addDays(fromDate, 14)
  if (frequency === 'monthly') return addMonthsClamped(fromDate, 1, options)
  return addMonthsClamped(fromDate, 12, options)
}

// ─── Generator decision (pure) ───────────────────────────────────────────────
//
// Given a rule, today's date, and whether a pending instance already exists,
// decide whether the generator should create a new pending instance for this
// rule, and if so, with which scheduled_date.
//
// Extracted from generateDueRecurrenceInstances so it can be tested without
// hitting the database. The generator wraps this with the DB fetch/insert.

export type RuleForDecision = {
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  frequency: RecurrenceFrequency
}

export type GenerationDecision =
  | { generate: false; reason: 'has_pending' | 'not_due' | 'past_end_date' }
  | { generate: true; scheduled_date: string }

export function decideRecurrenceInstance(
  rule: RuleForDecision,
  today: string,
  hasPending: boolean,
): GenerationDecision {
  // 1. Skip if there's already a pending instance for this rule. The DB-level
  //    UNIQUE INDEX recurrence_instances_one_pending_per_rule enforces this
  //    invariant; we also short-circuit it here to avoid useless inserts.
  if (hasPending) return { generate: false, reason: 'has_pending' }

  // 2. Compute the next occurrence anchored to start_date so the day-of-month
  //    is preserved across short months (e.g. monthly rule starting on 31
  //    becomes 28/29 in February but goes back to 31 the next month).
  const baseDate = rule.last_generated_date ?? rule.start_date
  const nextDate = getNextRecurrenceDate(baseDate, rule.frequency, {
    anchorDate: rule.start_date,
  })

  // 3. If the next date is still in the future, nothing to do yet.
  if (nextDate > today) return { generate: false, reason: 'not_due' }

  // 4. If the rule has an end_date and we've moved past it, the rule is
  //    finished — no more instances generated. Status remains 'active' in DB
  //    (the UI labels it "Finalizada" by comparing today vs end_date).
  if (rule.end_date != null && nextDate > rule.end_date) {
    return { generate: false, reason: 'past_end_date' }
  }

  return { generate: true, scheduled_date: nextDate }
}

// ─── Suggestion detection (pure) ─────────────────────────────────────────────
//
// Detect recurrence candidates from a flat list of recent movements. No DB
// access here — the caller fetches the inputs and decides what to do with the
// output (render a banner, persist a dismissal, etc.).

export type SuggestionMovement = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
  amount: number
  date: string // ISO YYYY-MM-DD
  description: string | null
}

export type RecurrenceSuggestion = {
  fingerprint: string
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
  amount: number
  frequency: RecurrenceFrequency
  start_date: string
  description: string | null
  occurrence_count: number
  /** Most-recent date observed, used to break ties between candidates. */
  last_seen_date: string
}

const FREQUENCY_RANGES: Record<RecurrenceFrequency, [number, number]> = {
  weekly: [5, 9],
  biweekly: [11, 17],
  monthly: [27, 32],
  annual: [355, 375],
}

const FREQUENCY_PRIORITY: RecurrenceFrequency[] = [
  'monthly',
  'biweekly',
  'weekly',
  'annual',
]

function streamKey(movement: SuggestionMovement): string {
  const second =
    movement.type === 'transfer'
      ? `dest:${movement.destination_account_id ?? ''}`
      : `cat:${movement.category_id ?? ''}`
  return `${movement.type}|${movement.account_id}|${second}|${movement.currency_code}`
}

function ruleKeyForExistingRule(rule: {
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
}): string {
  const second =
    rule.movement_type === 'transfer'
      ? `dest:${rule.destination_account_id ?? ''}`
      : `cat:${rule.category_id ?? ''}`
  return `${rule.movement_type}|${rule.account_id}|${second}|${rule.currency_code}`
}

function daysBetween(isoA: string, isoB: string): number {
  const [yA, mA, dA] = isoA.split('-').map(Number)
  const [yB, mB, dB] = isoB.split('-').map(Number)
  const a = Date.UTC(yA, mA - 1, dA)
  const b = Date.UTC(yB, mB - 1, dB)
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function detectFrequency(gaps: number[]): RecurrenceFrequency | null {
  if (gaps.length < 2) return null

  const matches: Record<RecurrenceFrequency, number> = {
    weekly: 0,
    biweekly: 0,
    monthly: 0,
    annual: 0,
  }

  for (const gap of gaps) {
    for (const freq of FREQUENCY_PRIORITY) {
      const [min, max] = FREQUENCY_RANGES[freq]
      if (gap >= min && gap <= max) {
        matches[freq] += 1
        break
      }
    }
  }

  let best: { freq: RecurrenceFrequency | null; count: number } = {
    freq: null,
    count: 0,
  }
  for (const freq of FREQUENCY_PRIORITY) {
    if (matches[freq] > best.count) {
      best = { freq, count: matches[freq] }
    }
  }
  return best.count >= 2 ? best.freq : null
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function buildFingerprint(
  suggestion: Omit<
    RecurrenceSuggestion,
    'fingerprint' | 'amount' | 'start_date' | 'description' | 'occurrence_count' | 'last_seen_date'
  >,
): string {
  const second =
    suggestion.movement_type === 'transfer'
      ? `dest:${suggestion.destination_account_id ?? ''}`
      : `cat:${suggestion.category_id ?? ''}`
  return `${suggestion.movement_type}|${suggestion.account_id}|${second}|${suggestion.currency_code}|${suggestion.frequency}`
}

export type ExistingRuleStream = Parameters<typeof ruleKeyForExistingRule>[0]

export function detectRecurrenceSuggestions(
  movements: SuggestionMovement[],
  dismissedFingerprints: Set<string>,
  existingRules: ExistingRuleStream[],
): RecurrenceSuggestion[] {
  const existingStreamKeys = new Set(existingRules.map(ruleKeyForExistingRule))

  const streams = new Map<string, SuggestionMovement[]>()
  for (const movement of movements) {
    if (movement.type === 'transfer' && !movement.destination_account_id) {
      continue
    }
    if (movement.type !== 'transfer' && !movement.category_id) {
      continue
    }
    const key = streamKey(movement)
    if (existingStreamKeys.has(key)) continue
    const bucket = streams.get(key) ?? []
    bucket.push(movement)
    streams.set(key, bucket)
  }

  const suggestions: RecurrenceSuggestion[] = []

  for (const bucket of streams.values()) {
    if (bucket.length < 3) continue

    const sorted = [...bucket].sort((a, b) => a.date.localeCompare(b.date))

    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }

    const frequency = detectFrequency(gaps)
    if (!frequency) continue

    const sample = sorted[0]
    const amountValue = median(sorted.map((m) => m.amount))
    const latest = sorted[sorted.length - 1]

    const fingerprintBase = {
      movement_type: sample.type,
      account_id: sample.account_id,
      destination_account_id: sample.destination_account_id,
      category_id: sample.category_id,
      currency_code: sample.currency_code,
      frequency,
    }
    const fingerprint = buildFingerprint(fingerprintBase)
    if (dismissedFingerprints.has(fingerprint)) continue

    suggestions.push({
      fingerprint,
      movement_type: sample.type,
      account_id: sample.account_id,
      destination_account_id: sample.destination_account_id,
      category_id: sample.category_id,
      currency_code: sample.currency_code,
      amount: Math.round(amountValue * 100) / 100,
      frequency,
      start_date: latest.date,
      description: latest.description,
      occurrence_count: sorted.length,
      last_seen_date: latest.date,
    })
  }

  // Strongest first: more occurrences, then more recent activity.
  suggestions.sort((a, b) => {
    if (b.occurrence_count !== a.occurrence_count) {
      return b.occurrence_count - a.occurrence_count
    }
    return b.last_seen_date.localeCompare(a.last_seen_date)
  })

  return suggestions
}
