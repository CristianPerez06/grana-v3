'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { FieldIcon, FieldLabel } from '@/components/ui/form-primitives'
import type { Institution } from '@/lib/accounts/types'

/**
 * Card-specific drawer form pieces (Alta + Editar). The neutral primitives
 * (SectionLabel/FieldLabel/FieldIcon/Hint/FIELD_BG) now live in
 * `components/ui/form-primitives` and are re-exported here so existing card
 * imports keep working; this module keeps only the card-shaped parts.
 */

export { FIELD_BG, FieldIcon, FieldLabel, Hint, SectionLabel } from '@/components/ui/form-primitives'

export const BAR_TRACK = '#EDF0F4'
// README `--faint`; there is no Tailwind token for it, so it stays a literal,
// used only by the preview's ghost (empty) state.
const GHOST_FAINT = '#AEB6C0'
const GHOST_MARK = 'var(--border)' // #E6EAEF — grey avatar/stripe while empty

export const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** "DD/MM" from a `YYYY-MM-DD` ISO date (empty string → null). */
export const dayMonth = (iso: string): string | null => {
  if (!iso) return null
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export const DateField = ({
  label,
  value,
  onChange,
  error,
  dotColor,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  /** Optional colored dot before the label (close = accent, due = terracotta). */
  dotColor?: string
}) => (
  <div className="flex flex-col gap-1">
    <label className="flex items-center gap-[7px] text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
      {dotColor && <span className="size-[7px] rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />}
      {label}
    </label>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm tabular-nums text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

/**
 * Bank/institution row: searchable input with a dropdown of institutions, each
 * showing its brand-colour monogram. Presentational — the parent owns the
 * `institutionId` / `search` state (and the "clear selection on mismatch" rule),
 * this component owns only its open/closed focus state.
 */
export const BankSelectorField = ({
  institutions,
  institutionId,
  search,
  onSearchChange,
  onSelect,
  label,
  placeholder,
  noResultsLabel,
}: {
  institutions: Institution[]
  institutionId: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (institution: Institution) => void
  label: string
  placeholder: string
  noResultsLabel: string
}) => {
  const [focused, setFocused] = useState(false)
  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="relative flex items-center gap-[13px] bg-card px-4 py-3">
      <FieldIcon>
        <Building2 className="size-[18px]" />
      </FieldIcon>
      <div className="min-w-0 flex-1">
        <FieldLabel>{label}</FieldLabel>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          aria-label={label}
          className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-medium placeholder:text-text-soft"
        />
      </div>
      {focused && !institutionId && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {filtered.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(inst)
                setFocused(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-page"
            >
              <span
                className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                style={{ backgroundColor: inst.brand_color ?? 'var(--account-slate)' }}
                aria-hidden
              >
                {(inst.name[0] ?? '?').toUpperCase()}
              </span>
              <span>{inst.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-muted">{noResultsLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Live card preview shown above both card forms. Mirrors the wallet card: accent
 * stripe, monogram avatar, limit bar and the `Cierra → Vence` cycle line.
 *
 * `ghost` renders the empty state (dashed border, grey "?" avatar, faint text)
 * for the create flow before an institution/network is chosen; edit never sets
 * it, so its rendering is unchanged by the extraction.
 */
export const CardPreview = ({
  caption,
  accent,
  monogram,
  name,
  meta,
  limitLabel,
  limitValue,
  limitPct,
  closeLabel,
  dueLabel,
  cycleUnknownLabel,
  closePrefix,
  duePrefix,
  ghost = false,
}: {
  caption: string
  accent: string
  monogram: string
  name: string
  meta: string
  limitLabel: string
  limitValue: string
  limitPct: number
  closeLabel: string | null
  dueLabel: string | null
  cycleUnknownLabel: string
  closePrefix: string
  duePrefix: string
  ghost?: boolean
}) => {
  const stripe = ghost ? GHOST_MARK : accent
  return (
    <div>
      <p className="mx-0.5 mb-[9px] flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[0.09em] text-text-soft">
        <span className="size-1.5 rounded-full bg-emerald" aria-hidden />
        {caption}
      </p>
      <div
        className={`relative overflow-hidden rounded-[20px] border bg-card px-6 pb-5 pt-[22px] ${
          ghost ? 'border-dashed border-border' : 'border-border'
        }`}
      >
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: stripe }} aria-hidden />
        <div className="mb-[18px] flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-[12px] text-[19px] font-extrabold"
            style={{ backgroundColor: stripe, color: ghost ? GHOST_FAINT : '#fff' }}
            aria-hidden
          >
            {ghost ? '?' : monogram}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[17px] font-bold tracking-[-0.015em]"
              style={ghost ? { color: GHOST_FAINT } : undefined}
            >
              {!ghost && <span className="text-text">{name}</span>}
              {ghost && name}
            </p>
            <p
              className="mt-0.5 truncate text-[13px]"
              style={{ color: ghost ? GHOST_FAINT : undefined }}
            >
              <span className={ghost ? '' : 'text-text-muted'}>{meta}</span>
            </p>
          </div>
        </div>
        <div className="mt-0.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] text-text-muted">
              {limitLabel} <b className="font-bold tabular-nums text-text">{limitValue}</b>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-[5px]" style={{ backgroundColor: BAR_TRACK }}>
            <div
              className="h-full rounded-[5px]"
              style={{ width: `${limitPct}%`, backgroundColor: accent }}
            />
          </div>
        </div>
        <div className="mt-[15px] flex items-center gap-3 border-t border-dashed border-border pt-3.5 text-[13px] font-semibold text-text-muted">
          {closeLabel && dueLabel ? (
            <>
              <span className="inline-flex items-center gap-[7px]">
                <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                {closePrefix} <b className="font-extrabold tabular-nums text-text">{closeLabel}</b>
              </span>
              <span className="font-extrabold text-text-soft" aria-hidden>
                →
              </span>
              <span className="inline-flex items-center gap-[7px]">
                <span className="size-2 rounded-full bg-terracotta" aria-hidden />
                {duePrefix} <b className="font-extrabold tabular-nums text-text">{dueLabel}</b>
              </span>
            </>
          ) : (
            <span>{cycleUnknownLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}
