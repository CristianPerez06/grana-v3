// Pure view-model logic for the compact cards list: bank grouping, ordering,
// urgency, the auto-collapse rule, the statement-usage percentage, and the view
// filters. No React, no Supabase — testable in isolation, shared by web and
// mobile from `@grana/cards`.

import type { CreditCardSummary } from './types'

/** Group urgency / row tone, matching `presentation.ts` → `pillTone`. */
export type CardTone = 'due' | 'soon' | 'ok'

/** Sentinel key for cards without an issuing institution → "Sin banco" group. */
export const NO_BANK_KEY = '__no_bank__'

export type ViewFilter = 'by-bank' | 'all' | 'in-use' | 'due-soon' | 'with-balance'

export type BankGroup = {
  /** Institution name, or `NO_BANK_KEY` for the fallback group. */
  key: string
  /** Display name; `null` → the UI renders the localized "Sin banco" label. */
  name: string | null
  /** Institution brand color for the group dot (or null → neutral). */
  brandColor: string | null
  cards: CreditCardSummary[]
  count: number
  inUseCount: number
  /** Sum of "a pagar" statements (closed/overdue, unpaid) — ARS and USD apart. */
  toPayARS: number
  toPayUSD: number
  /** Earliest active-period due date in the group (ISO), or null. */
  nextDueDate: string | null
  /** Worst tone among the group's cards (drives the header urgency badge). */
  tone: CardTone
  /** Initial collapsed state: only banks fully `ok` and at $0 start collapsed. */
  defaultCollapsed: boolean
}

const TONE_RANK: Record<CardTone, number> = { due: 0, soon: 1, ok: 2 }

/** Per-card tone, same rule as `pillTone(period.alert, period.variant)`. */
export const cardTone = (card: CreditCardSummary): CardTone => {
  const period = card.activePeriod
  if (!period) return 'ok'
  if (period.variant === 'vencido' || period.variant === 'cerrado_esperando_pago' || period.alert === 'red')
    return 'due'
  if (period.alert === 'amber') return 'soon'
  return 'ok'
}

/** A statement that closed/overdue and is unpaid counts toward "a pagar". */
const cardToPay = (card: CreditCardSummary): boolean => {
  const v = card.activePeriod?.variant
  return v === 'vencido' || v === 'cerrado_esperando_pago'
}

/** Has any pending balance this cycle, in either currency (never summed). */
export const cardHasBalance = (card: CreditCardSummary): boolean => {
  const p = card.activePeriod
  return (p?.pendingAmountARS ?? 0) > 0 || (p?.pendingAmountUSD ?? 0) > 0
}

/**
 * Statement-usage percentage: the active period's pending ARS over the credit
 * limit, clamped to 0–100. `null` when no limit is loaded (the UI shows "—").
 * NOTE: this is usage of the CURRENT statement, not real available credit.
 */
export const cardUsePercent = (card: CreditCardSummary): number | null => {
  const limit = card.credit_limit
  if (!limit || limit <= 0) return null
  const pending = card.activePeriod?.pendingAmountARS ?? 0
  return Math.min(100, Math.max(0, Math.round((pending / limit) * 100)))
}

const worstTone = (a: CardTone, b: CardTone): CardTone => (TONE_RANK[a] <= TONE_RANK[b] ? a : b)

/** Sort cards by active-period due date ascending; cards without a cycle last. */
export const sortCardsByDue = (cards: CreditCardSummary[]): CreditCardSummary[] =>
  [...cards].sort((a, b) => {
    const da = a.activePeriod?.due_date ?? null
    const db = b.activePeriod?.due_date ?? null
    if (da === db) return a.name.localeCompare(b.name)
    if (da === null) return 1
    if (db === null) return -1
    return da.localeCompare(db)
  })

/** Apply a view filter to the flat card list. */
export const applyFilter = (cards: CreditCardSummary[], filter: ViewFilter): CreditCardSummary[] => {
  switch (filter) {
    case 'in-use':
      return cards.filter((c) => c.inUse)
    case 'due-soon':
      return cards.filter((c) => cardTone(c) !== 'ok')
    case 'with-balance':
      return cards.filter(cardHasBalance)
    default:
      return cards
  }
}

/**
 * Group cards by issuing bank. Cards without an institution fall into the
 * "Sin banco" group, always rendered last. Groups are ordered by worst tone
 * (due → soon → ok), then by earliest due date; cards within a group are sorted
 * by due date ascending.
 */
export const groupCardsByBank = (cards: CreditCardSummary[]): BankGroup[] => {
  const byKey = new Map<string, CreditCardSummary[]>()
  for (const card of cards) {
    const name = card.institution?.name ?? null
    const key = name ?? NO_BANK_KEY
    const list = byKey.get(key) ?? []
    list.push(card)
    byKey.set(key, list)
  }

  const groups: BankGroup[] = []
  for (const [key, groupCards] of byKey) {
    const sorted = sortCardsByDue(groupCards)
    let toPayARS = 0
    let toPayUSD = 0
    let tone: CardTone = 'ok'
    let nextDueDate: string | null = null
    let inUseCount = 0
    let allOkAndZero = true

    for (const card of sorted) {
      const t = cardTone(card)
      tone = worstTone(tone, t)
      if (card.inUse) inUseCount += 1
      if (cardToPay(card)) {
        toPayARS += card.activePeriod?.pendingAmountARS ?? 0
        toPayUSD += card.activePeriod?.pendingAmountUSD ?? 0
      }
      const due = card.activePeriod?.due_date ?? null
      if (due && (nextDueDate === null || due < nextDueDate)) nextDueDate = due
      if (t !== 'ok' || cardHasBalance(card)) allOkAndZero = false
    }

    groups.push({
      key,
      name: key === NO_BANK_KEY ? null : key,
      brandColor: sorted[0]?.institution?.brand_color ?? null,
      cards: sorted,
      count: sorted.length,
      inUseCount,
      toPayARS,
      toPayUSD,
      nextDueDate,
      tone,
      defaultCollapsed: allOkAndZero,
    })
  }

  groups.sort((a, b) => {
    // "Sin banco" always last.
    if (a.key === NO_BANK_KEY) return 1
    if (b.key === NO_BANK_KEY) return -1
    if (a.tone !== b.tone) return TONE_RANK[a.tone] - TONE_RANK[b.tone]
    if (a.nextDueDate === b.nextDueDate) return (a.name ?? '').localeCompare(b.name ?? '')
    if (a.nextDueDate === null) return 1
    if (b.nextDueDate === null) return -1
    return a.nextDueDate.localeCompare(b.nextDueDate)
  })

  return groups
}
