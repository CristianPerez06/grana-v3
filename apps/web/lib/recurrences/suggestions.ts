import type { RecurrenceFrequency } from './date'

// Pure algorithm to detect recurrence suggestions from a user's recent
// movements. No DB access here — the caller fetches the inputs and decides
// what to do with the output (render a banner, persist a dismissal, etc.).

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

  // Pick the frequency with the most matches; require >= 2. Ties resolved by
  // FREQUENCY_PRIORITY (monthly > biweekly > weekly > annual). Monthly first
  // because it is by far the most common pattern in real-life budgeting.
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

/**
 * Detects recurrence suggestions from a flat list of recent movements.
 *
 * @param movements - candidate movements (already filtered: no installment
 *   parents/children, no adjustments, no rows already linked to a confirmed
 *   recurrence instance).
 * @param dismissedFingerprints - fingerprints the user previously dismissed.
 * @param existingRules - rules already active/paused for the user; their
 *   streams are excluded so we don't double-suggest.
 *
 * Returns suggestions sorted by strength: more occurrences first, then more
 * recent activity. Callers typically pick the top one.
 */
export function detectRecurrenceSuggestions(
  movements: SuggestionMovement[],
  dismissedFingerprints: Set<string>,
  existingRules: ExistingRuleStream[],
): RecurrenceSuggestion[] {
  const existingStreamKeys = new Set(existingRules.map(ruleKeyForExistingRule))

  // Group by stream key.
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
