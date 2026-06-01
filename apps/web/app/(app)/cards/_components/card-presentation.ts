import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { CardPeriodAlert } from '@/lib/cards/queries'
import type { CardPillTone } from './card-status-pill'

/**
 * Per-card accent color (`--cc-accent` in the design handoff). Derived from the
 * resolved avatar, never hardcoded by brand: a user color override or, failing
 * that, a deterministic palette color from the account id. Returns a CSS color
 * string ready for inline `style` (token var or raw override).
 */
export const cardAccent = (card: {
  id: string
  name: string
  color_key: string | null
  icon_key: string | null
}): string => {
  const avatar = resolveAccountAvatar({
    id: card.id,
    name: card.name,
    type: 'credit',
    color_key: card.color_key,
    icon_key: card.icon_key,
  })
  return avatar.colorKey ? `var(--account-${avatar.colorKey})` : (avatar.colorOverride ?? 'var(--account-slate)')
}

/** Uppercased first letter of the card name (avatar monogram). */
export const cardMonogram = (name: string): string => {
  const trimmed = name.trim()
  return (trimmed.length > 0 ? trimmed[0] : '?').toUpperCase()
}

/**
 * Map a card's active-period alert + variant to the wallet/detail pill tone:
 *  - `due`  (terracota): the statement closed/overdue and is unpaid with debt.
 *  - `soon` (amber): the due date is near (alert='amber') or it closes soon.
 *  - `ok`   (emerald): up to date.
 */
export const pillTone = (
  alert: CardPeriodAlert,
  variant: string | null,
): CardPillTone => {
  if (variant === 'vencido' || variant === 'cerrado_esperando_pago' || alert === 'red') return 'due'
  if (alert === 'amber') return 'soon'
  return 'ok'
}

/** Short "DD/MM" for a `YYYY-MM-DD` ISO date. */
export const formatDayMonth = (iso: string | null): string => {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
