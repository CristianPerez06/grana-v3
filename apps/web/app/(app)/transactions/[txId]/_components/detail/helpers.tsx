import type { CSSProperties } from 'react'
import {
  CreditCard,
  Landmark,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { Tone } from '@/lib/transactions/components/tone'
import type { TransactionAccount } from '@/lib/transactions/types'

/** AR money, absolute value (the sign/tone is carried by the surrounding UI). */
export const fmtMoney = (amount: number, currency: 'ARS' | 'USD', showCents: boolean): string =>
  currency === 'ARS' ? formatARS(Math.abs(amount), showCents) : formatUSD(Math.abs(amount), showCents)

// ── Tono por tipo ──────────────────────────────────────────────────────────────
// El handoff pinta el detalle con un único "tono" por tipo (gasto/ingreso/
// transfer). Lo portamos a CSS vars locales (`--tone/--tone-soft/--tone-deep`)
// seteadas inline en el contenedor raíz y consumidas por los tiles con
// `text-[var(--tone)]`, `bg-[var(--tone-soft)]`, etc. Cada var REFERENCIA un
// token de `@grana/ui-tokens` — sin hex sueltos.

export type DetailTone = 'gasto' | 'ingreso' | 'transfer'

/** Editorial Tone (income/expense/neutral/pending) → tono visual del detalle. */
export const detailToneFromTone = (tone: Tone): DetailTone => {
  if (tone === 'income' || tone === 'pending') return 'ingreso'
  if (tone === 'neutral') return 'transfer'
  return 'gasto'
}

const TONE_TOKENS: Record<DetailTone, { tone: string; soft: string; deep: string }> = {
  gasto: { tone: 'var(--terracotta)', soft: 'var(--terracotta-soft)', deep: 'var(--terracotta-deep)' },
  ingreso: { tone: 'var(--emerald-deep)', soft: 'var(--emerald-soft)', deep: 'var(--emerald-deep)' },
  transfer: { tone: 'var(--slate)', soft: 'var(--slate-soft)', deep: 'var(--slate-deep)' },
}

/** Inline style that exposes `--tone/--tone-soft/--tone-deep` for the subtree. */
export const toneVars = (tone: DetailTone): CSSProperties =>
  ({
    '--tone': TONE_TOKENS[tone].tone,
    '--tone-soft': TONE_TOKENS[tone].soft,
    '--tone-deep': TONE_TOKENS[tone].deep,
  }) as CSSProperties

// ── Medio de pago ──────────────────────────────────────────────────────────────
// App de gestión, NO opera pagos: NUNCA mostramos número de tarjeta. Solo el
// nombre de la cuenta + una etiqueta de tipo y un badge de color por tipo.

export type PaymentMethodDescriptor = {
  /** Account name — the badge headline (never a card number). */
  name: string
  /** Type sublabel i18n key under `transactions.detail.payment_sub.*`. */
  subKey: 'cash' | 'bank' | 'credit'
  icon: LucideIcon
  /** Tailwind bg token class for the colored badge. */
  badgeClass: string
}

export const paymentMethodDescriptor = (
  account: Pick<TransactionAccount, 'name' | 'type'> | null | undefined,
): PaymentMethodDescriptor | null => {
  if (!account?.name) return null
  switch (account.type) {
    case 'credit':
      return { name: account.name, subKey: 'credit', icon: CreditCard, badgeClass: 'bg-warning' }
    case 'bank':
      return { name: account.name, subKey: 'bank', icon: Landmark, badgeClass: 'bg-slate' }
    case 'cash':
    default:
      return { name: account.name, subKey: 'cash', icon: Wallet, badgeClass: 'bg-warning' }
  }
}

// ── Fechas (solo fecha, sin hora) ───────────────────────────────────────────────

const parseISO = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day)
}

/** "18 jun 2026" — abreviado, sin el punto que mete es-AR en el mes. */
export const formatShortDate = (dateStr: string): string =>
  parseISO(dateStr)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')

/** "miércoles, 18 de junio de 2026" — largo, para la línea de contexto. */
export const formatLongDate = (dateStr: string): string =>
  parseISO(dateStr).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/** "jun" — etiqueta de mes corta para las barras de historial. */
export const formatMonthShort = (dateStr: string): string =>
  parseISO(dateStr).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')

/** "feb 2024" — mes + año, para "activa desde". */
export const formatMonthYear = (dateStr: string): string =>
  parseISO(dateStr).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')

/** "Mayo 2026" para el período de tarjeta; cae al rango cuando cruza de mes. */
export const formatPeriodLabel = (
  period: { start_date: string; end_date: string } | null | undefined,
): string => {
  if (!period) return ''
  const start = parseISO(period.start_date)
  const end = parseISO(period.end_date)
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }
  return `${formatShortDate(period.start_date)} – ${formatShortDate(period.end_date)}`
}
