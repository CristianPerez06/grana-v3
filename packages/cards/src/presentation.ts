import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { CardPeriodAlert } from './types'
import { isEmptyVariant, type CardTone } from './grouping'

/**
 * Per-card accent color (`--cc-accent` in the design handoff). Derived from the
 * resolved avatar: a user color override, else the issuing institution's
 * `brand_color` (live-inherited, same as bank accounts), else a deterministic
 * palette color from the account id. Returns a CSS color string ready for
 * inline `style` (token var or raw override).
 */
export const cardAccent = (
  card: {
    id: string
    name: string
    color_key: string | null
    icon_key: string | null
  },
  institution?: { brand_color: string | null } | null,
): string => {
  const avatar = resolveAccountAvatar(
    {
      id: card.id,
      name: card.name,
      type: 'credit',
      color_key: card.color_key,
      icon_key: card.icon_key,
    },
    institution ? { brand_color: institution.brand_color, icon_type: null } : null,
  )
  return avatar.colorKey ? `var(--account-${avatar.colorKey})` : (avatar.colorOverride ?? 'var(--account-slate)')
}

/** Uppercased first letter of the card name (avatar monogram). */
export const cardMonogram = (name: string): string => {
  const trimmed = name.trim()
  return (trimmed.length > 0 ? trimmed[0] : '?').toUpperCase()
}

/**
 * Map a card's active-period alert + variant to the wallet/detail pill tone
 * (`CardTone`, the single tone union shared with `grouping.ts`):
 *  - `due`  (terracota): the statement closed/overdue and is unpaid with debt.
 *  - `soon` (amber): the due date is near (alert='amber') or it closes soon.
 *  - `ok`   (emerald): up to date.
 *  - `empty` (neutral): the statement has no charges ("Sin consumos").
 */
export const pillTone = (
  alert: CardPeriodAlert,
  variant: string | null,
): CardTone => {
  if (variant === 'vencido' || variant === 'cerrado_esperando_pago') return 'due'
  if (isEmptyVariant(variant)) return 'empty'
  if (alert === 'red') return 'due'
  if (alert === 'amber') return 'soon'
  return 'ok'
}

/** Short "DD/MM" for a `YYYY-MM-DD` ISO date. */
export const formatDayMonth = (iso: string | null): string => {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type CyclePeriodInput = {
  id: string
  start_date: string
  end_date: string
  due_date: string
  has_payment: boolean
  is_estimated?: boolean
}

/**
 * Resolve the editable billing cycle for a card from its periods: the "resumen
 * actual" (period covering today, else the latest unpaid, else the most recent)
 * plus the "próximo resumen" (the period immediately after it). Returns the
 * shape consumed by `EditCardForm`'s `cycle` prop — editable post-creation via
 * `updatePeriodDates`. Estimated periods (projected, not yet confirmed against
 * a statement) are flagged so the form can mark their dates.
 */
export const resolveEditCycle = (periods: CyclePeriodInput[], todayISO: string) => {
  const sorted = [...periods].sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
  const current =
    sorted.find((p) => p.start_date <= todayISO && todayISO <= p.end_date) ??
    sorted.find((p) => !p.has_payment) ??
    sorted[0] ??
    null
  const idx = current ? sorted.findIndex((p) => p.id === current.id) : -1
  const next = idx >= 0 ? (sorted[idx + 1] ?? null) : null
  return {
    currentPeriodId: current?.id ?? null,
    currentEndDate: current?.end_date ?? null,
    currentDueDate: current?.due_date ?? null,
    currentPeriodIsEstimated: current?.is_estimated ?? false,
    nextPeriodId: next?.id ?? null,
    nextEndDate: next?.end_date ?? null,
    nextDueDate: next?.due_date ?? null,
    nextPeriodIsPaid: next?.has_payment ?? false,
    nextPeriodIsEstimated: next?.is_estimated ?? false,
  }
}

export type CycleDateWrite = {
  periodId: string
  end_date: string
  due_date: string
}

/**
 * The period-date writes the edit form must issue, in order. Only pairs that
 * changed are written. The current period goes first (its close cascades the
 * next one's start) — EXCEPT when the new current close reaches or passes the
 * next period's STORED close and the next pair also changed: then the next goes
 * first, so the current close never lands on a period still ending before it.
 * Shared so web and mobile cannot drift.
 */
export const orderCycleDateWrites = (
  cycle: {
    currentPeriodId: string | null
    currentEndDate: string | null
    currentDueDate: string | null
    nextPeriodId: string | null
    nextEndDate: string | null
    nextDueDate: string | null
  },
  edited: { currentEnd: string; currentDue: string; nextEnd: string; nextDue: string },
): CycleDateWrite[] => {
  const current =
    cycle.currentPeriodId &&
    (edited.currentEnd !== (cycle.currentEndDate ?? '') ||
      edited.currentDue !== (cycle.currentDueDate ?? ''))
      ? { periodId: cycle.currentPeriodId, end_date: edited.currentEnd, due_date: edited.currentDue }
      : null
  const next =
    cycle.nextPeriodId &&
    (edited.nextEnd !== (cycle.nextEndDate ?? '') || edited.nextDue !== (cycle.nextDueDate ?? ''))
      ? { periodId: cycle.nextPeriodId, end_date: edited.nextEnd, due_date: edited.nextDue }
      : null

  if (current && next && cycle.nextEndDate && current.end_date >= cycle.nextEndDate) {
    return [next, current]
  }
  return [current, next].filter((w): w is CycleDateWrite => w !== null)
}

