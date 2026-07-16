import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { Tone } from '@grana/transactions'
import type { Locale } from '../../../lib/locale'

// Date/money/tone helpers for the movement detail — the mobile mirror of web's
// `detail/helpers.tsx`. Hermes has no full `Intl` (no `toLocaleDateString` with
// weekday/month), so the labels are composed from hand-rolled tables, the same
// approach as `MovementList` and the accounts rows.

/** AR/US money, absolute value (the sign/tone is carried by the surrounding UI). */
export const fmtMoney = (amount: number, currency: 'ARS' | 'USD', showCents: boolean): string =>
  currency === 'ARS'
    ? formatARS(Math.abs(amount), showCents)
    : formatUSD(Math.abs(amount), showCents)

const WEEKDAYS: Record<Locale, readonly string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}
const MONTHS_LONG: Record<Locale, readonly string[]> = {
  es: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}
const MONTHS_SHORT: Record<Locale, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

/** "18 jun 2026" — short, for the hero chip / list rows. */
export const formatShortDate = (iso: string, locale: Locale): string => {
  const [y, m, d] = parts(iso)
  return `${d} ${MONTHS_SHORT[locale][m - 1]} ${y}`
}

/** "miércoles, 18 de junio de 2026" — long, for the "Fecha" detail row. */
export const formatLongDate = (iso: string, locale: Locale): string => {
  const [y, m, d] = parts(iso)
  const dow = new Date(y, m - 1, d).getDay()
  const weekday = WEEKDAYS[locale][dow]
  const month = MONTHS_LONG[locale][m - 1]
  return locale === 'es'
    ? `${weekday}, ${d} de ${month} de ${y}`
    : `${weekday}, ${month} ${d}, ${y}`
}

// ── Tono por tipo ──────────────────────────────────────────────────────────────
// Mirror of web's `detailToneFromTone` + tone tokens, mapped to NativeWind
// structural classes (terracotta = negative, emerald = income, slate = transfer).
// Each token references `@grana/ui-tokens`; no loose hex.

export type DetailTone = 'gasto' | 'ingreso' | 'transfer'

/** Editorial Tone (income/expense/neutral/pending) → visual detail tone. */
export const detailToneFromTone = (tone: Tone): DetailTone =>
  tone === 'income' || tone === 'pending'
    ? 'ingreso'
    : tone === 'neutral'
      ? 'transfer'
      : 'gasto'

export type DetailToneClasses = {
  /** Big amount / tonal accent text color. */
  text: string
  /** Tinted soft background (hero band, icon box). */
  softBg: string
  /** Solid fill (progress bar segment, avatar). */
  fill: string
}

const TONE_CLASSES: Record<DetailTone, DetailToneClasses> = {
  gasto: { text: 'text-terracotta', softBg: 'bg-terracotta-soft', fill: 'bg-terracotta' },
  ingreso: { text: 'text-emerald-deep', softBg: 'bg-emerald-soft', fill: 'bg-emerald-deep' },
  transfer: { text: 'text-slate', softBg: 'bg-slate-soft', fill: 'bg-slate' },
}

export const toneClasses = (tone: Tone): DetailToneClasses => TONE_CLASSES[detailToneFromTone(tone)]

// ── Medio de pago ──────────────────────────────────────────────────────────────
// App de gestión, NUNCA muestra número de tarjeta. Mirror of web's
// `paymentMethodDescriptor` (name/institution split + type sublabel key).

export type PaymentMethodDescriptor = {
  /** Headline: the institution (bank) when known, else the account name. */
  name: string
  /** Secondary line: the account name when it differs from the institution. */
  secondary: string | null
  /** Type sublabel i18n key under `transactions.detail.payment_sub.*`. */
  subKey: 'cash' | 'bank' | 'credit'
}

export const paymentMethodDescriptor = (
  account:
    | { name?: string | null; type?: 'cash' | 'bank' | 'credit'; institution?: { name: string | null } | null }
    | null
    | undefined,
): PaymentMethodDescriptor | null => {
  if (!account?.name) return null
  const inst = account.institution?.name?.trim() || null
  const name = inst || account.name
  const secondary = inst && inst !== account.name ? account.name : null
  const subKey: 'cash' | 'bank' | 'credit' =
    account.type === 'credit' ? 'credit' : account.type === 'bank' ? 'bank' : 'cash'
  return { name, secondary, subKey }
}
