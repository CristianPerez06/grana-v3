'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'

/**
 * Account-specific drawer form pieces (Alta + Editar). The neutral primitives
 * (SectionLabel/FieldLabel/FieldIcon/Hint) live in `components/ui/form-primitives`;
 * this module holds only the account-shaped parts: the live preview card, the
 * ARS/USD money rows (editable + locked) and the generic locked field.
 */

// README `--locked` (#EFF2F5) ≈ the `--border-soft` token; the inner icon chip
// has no token, so it stays a literal — used only by the read-only edit fields.
const LOCKED_ICON_BG = '#E4E9EE'
// ARS currency chip — README `--slate-soft`; no Tailwind token maps to it.
const ARS_CHIP_BG = '#EAF1F6'

/** Avatar descriptor for the preview: a wallet/bank glyph or a monogram. */
export type PreviewAvatar = {
  /** `wallet` (cash) · `bank` (bancaria, no institution) · `monogram` (bank w/ initial). */
  kind: 'wallet' | 'bank' | 'monogram'
  monogram?: string
  bg: string
  fg: string
}

const WalletGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[21px]" aria-hidden>
    <path d="M3 7a2 2 0 012-2h13a2 2 0 012 2v2H5a2 2 0 00-2 2V7z" />
    <path d="M3 11h17a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z" />
  </svg>
)

const BankGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[21px]" aria-hidden>
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v9M19 10v9M9 10v9M15 10v9" />
    <path d="M3 21h18" />
  </svg>
)

/**
 * Live account preview shown above both account forms. Mirrors the wallet card:
 * avatar (cash = terracotta wallet, bank = brand colour + initial), name, meta
 * ("Efectivo" / "Débito · {banco}"), type badge and ARS/USD balances. `ghost`
 * renders the empty state (dashed border, faint text) for the create flow before
 * the user has typed anything.
 */
export const AccountPreview = ({
  caption,
  avatar,
  name,
  nameGhost,
  meta,
  badgeLabel,
  badgeBg,
  badgeColor,
  arsLabel,
  usdLabel,
  ghost = false,
}: {
  caption: string
  avatar: PreviewAvatar
  name: string
  /** Faint the name (no real value typed yet — falls back to a placeholder). */
  nameGhost: boolean
  meta: string
  badgeLabel: string
  badgeBg: string
  badgeColor: string
  arsLabel: string
  /** Secondary USD line, or null when USD balance is 0. */
  usdLabel: string | null
  ghost?: boolean
}) => (
  <div>
    <p className="mx-0.5 mb-[9px] flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[0.09em] text-text-soft">
      <span className="size-1.5 rounded-full bg-emerald" aria-hidden />
      {caption}
    </p>
    <div
      className={`rounded-[20px] border bg-card px-[22px] pb-[18px] pt-5 ${
        ghost ? 'border-dashed border-border' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-[13px]">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[13px] text-[19px] font-extrabold"
          style={{ backgroundColor: avatar.bg, color: avatar.fg }}
          aria-hidden
        >
          {avatar.kind === 'wallet' ? <WalletGlyph /> : avatar.kind === 'bank' ? <BankGlyph /> : avatar.monogram}
        </span>
        <div className="min-w-0">
          <p
            className={`truncate text-[16px] font-bold tracking-[-0.015em] ${
              nameGhost ? 'text-text-soft' : 'text-text'
            }`}
          >
            {name}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">{meta}</p>
        </div>
        <span
          className="ml-auto shrink-0 self-start rounded-[6px] px-[9px] py-1 text-[10px] font-bold uppercase tracking-[0.05em]"
          style={{ backgroundColor: badgeBg, color: badgeColor }}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-[9px]">
        <span className="text-[13px] font-semibold opacity-55">$</span>
        <span className="text-[26px] font-bold tracking-[-0.02em] tabular-nums">{arsLabel}</span>
      </div>
      {usdLabel && <p className="mt-1 text-[13px] font-semibold text-text-muted tabular-nums">{usdLabel}</p>}
    </div>
  </div>
)

/** One editable currency row (ARS or USD) inside the money group. */
const MoneyRow = ({
  currency,
  label,
  sub,
  chipBg,
  chipColor,
  prefix,
  value,
  onChange,
  allowNegative,
}: {
  currency: 'ARS' | 'USD'
  label: string
  sub: string
  chipBg: string
  chipColor: string
  prefix: string
  value: string
  onChange: (value: string) => void
  allowNegative?: boolean
}) => (
  <div className="flex items-center gap-[13px] bg-card px-4 py-[13px]">
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold"
      style={{ backgroundColor: chipBg, color: chipColor }}
      aria-hidden
    >
      {currency === 'ARS' ? '$' : 'U$'}
    </span>
    <div>
      <p className="text-sm font-bold tracking-[-0.01em] text-text">{label}</p>
      <p className="mt-px text-[11.5px] font-semibold text-text-soft">{sub}</p>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <span className="text-sm font-bold text-text-soft">{prefix}</span>
      <MoneyAmountInput
        value={value}
        onChange={onChange}
        allowNegative={allowNegative}
        placeholder="0"
        aria-label={label}
        className="w-[132px] rounded-[10px] border border-border bg-[#FAFBFC] px-3 py-[9px] text-right text-base font-bold tabular-nums tracking-[-0.01em] text-text outline-none focus-visible:border-[#C9CFD7] focus-visible:ring-[3px] focus-visible:ring-[rgba(58,107,138,0.12)] placeholder:font-semibold placeholder:text-text-soft"
      />
    </div>
  </div>
)

/**
 * Money group with the two editable currency rows (ARS + USD). Both currencies
 * apply to every account type — including cash — per "bimoneda por defecto".
 */
export const EditableMoneyGroup = ({
  arsLabel,
  usdLabel,
  arsSub,
  usdSub,
  arsValue,
  usdValue,
  onArsChange,
  onUsdChange,
  allowNegative,
}: {
  arsLabel: string
  usdLabel: string
  arsSub: string
  usdSub: string
  arsValue: string
  usdValue: string
  onArsChange: (value: string) => void
  onUsdChange: (value: string) => void
  // Permite saldo inicial negativo (cuenta en rojo) en ambas monedas.
  allowNegative?: boolean
}) => (
  <div className="overflow-hidden rounded-[15px] border border-border [&>*+*]:border-t [&>*+*]:border-border">
    <MoneyRow
      currency="ARS"
      label={arsLabel}
      sub={arsSub}
      chipBg={ARS_CHIP_BG}
      chipColor="var(--account-slate)"
      prefix="$"
      value={arsValue}
      onChange={onArsChange}
      allowNegative={allowNegative}
    />
    <MoneyRow
      currency="USD"
      label={usdLabel}
      sub={usdSub}
      chipBg="var(--emerald-bg)"
      chipColor="var(--emerald-deep)"
      prefix="US$"
      value={usdValue}
      onChange={onUsdChange}
      allowNegative={allowNegative}
    />
  </div>
)

/** One read-only currency row (edit flow): formatted value + lock, no input. */
const LockedMoneyRow = ({
  currency,
  label,
  sub,
  value,
}: {
  currency: 'ARS' | 'USD'
  label: string
  sub: string
  value: string
}) => (
  <div className="flex items-center gap-[13px] bg-border-soft px-4 py-3.5">
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold text-text-muted"
      style={{ backgroundColor: LOCKED_ICON_BG }}
      aria-hidden
    >
      {currency === 'ARS' ? '$' : 'U$'}
    </span>
    <div>
      <p className="text-sm font-bold tracking-[-0.01em] text-text-muted">{label}</p>
      <p className="mt-px text-[11.5px] font-semibold text-text-soft">{sub}</p>
    </div>
    <span className="ml-auto inline-flex shrink-0 items-center gap-[7px] text-base font-bold tabular-nums text-text-muted">
      {value}
      <Lock className="size-[15px] text-text-soft" aria-hidden />
    </span>
  </div>
)

/** Locked money group (edit flow): ARS + USD shown read-only with a lock. */
export const LockedMoneyGroup = ({
  arsLabel,
  usdLabel,
  arsSub,
  usdSub,
  arsValue,
  usdValue,
}: {
  arsLabel: string
  usdLabel: string
  arsSub: string
  usdSub: string
  arsValue: string
  usdValue: string
}) => (
  <div className="overflow-hidden rounded-[15px] border border-border bg-border-soft [&>*+*]:border-t [&>*+*]:border-border">
    <LockedMoneyRow currency="ARS" label={arsLabel} sub={arsSub} value={arsValue} />
    <LockedMoneyRow currency="USD" label={usdLabel} sub={usdSub} value={usdValue} />
  </div>
)

/**
 * Generic read-only field with a lock (edit flow): faint icon chip + value in
 * `--muted` + lock on the right. Used for the immutable account type.
 */
export const LockedField = ({ icon, value }: { icon: ReactNode; value: string }) => (
  <div className="flex items-center gap-[13px] rounded-[15px] border border-border bg-border-soft px-4 py-3.5">
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
      style={{ backgroundColor: LOCKED_ICON_BG }}
      aria-hidden
    >
      {icon}
    </span>
    <span className="flex-1 text-[15px] font-bold tracking-[-0.01em] text-text-muted">{value}</span>
    <Lock className="size-4 shrink-0 text-text-soft" aria-hidden />
  </div>
)
