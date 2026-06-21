'use client'

import { useState } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  ACCOUNT_COLOR_HEX,
  ACCOUNT_COLOR_KEYS,
  type AccountColorKey,
} from '@grana/ui-contracts'
import { FieldIcon, FieldLabel } from '@/components/ui/form-primitives'
import { createCustomInstitution } from '@/app/_actions/institutions'
import type { Institution } from '@/lib/accounts/types'

/**
 * Institution selector for the account drawers. Visual model of the "Alta de
 * tarjeta" bank field (icon chip + inline search + dropdown of brand-colour
 * monograms), extended with the inline "+ Agregar institución" create flow the
 * accounts forms already had (`createCustomInstitution`). The parent owns the
 * `institutionId` / `search` state so the live preview can react; this component
 * owns only its focus + create-mode state.
 */
export const BankSelector = ({
  institutions,
  institutionId,
  search,
  onSearchChange,
  onSelect,
  label,
  placeholder,
}: {
  institutions: Institution[]
  institutionId: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (institution: Institution) => void
  label: string
  placeholder: string
}) => {
  const t = useTranslations('accounts')
  const [focused, setFocused] = useState(false)
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [createPrefill, setCreatePrefill] = useState('')

  const selected = institutionId ? institutions.find((i) => i.id === institutionId) ?? null : null
  // While the field still shows the already-selected institution's name (no new
  // query typed yet), list everything so a click opens the full list to switch;
  // once the user starts typing, filter by the query.
  const isPristineSelection = selected != null && search.trim() === selected.name
  const filtered = isPristineSelection
    ? institutions
    : institutions.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
  const noMatches = filtered.length === 0 && search.trim().length > 0
  const showDropdown = focused && mode === 'list'

  const openCreate = (prefill: string) => {
    setCreatePrefill(prefill)
    setMode('create')
    setFocused(false)
  }

  if (mode === 'create') {
    return (
      <CustomInstitutionInlineForm
        initialName={createPrefill}
        onCreated={(inst) => {
          setMode('list')
          onSelect(inst)
        }}
        onCancel={() => setMode('list')}
      />
    )
  }

  return (
    // Radix Popover (Anchor + portal'd Content) gives the dropdown collision-aware
    // flip, an adaptive max-height, and escape from the drawer's `overflow-hidden`
    // — without it the absolute list was clipped and never flipped up. We keep the
    // inline search input as the anchor and our own focus/blur logic as the single
    // source of open/close (Radix only positions), so typeahead focus is preserved.
    <RadixPopover.Root open={showDropdown} onOpenChange={(o) => { if (!o) setFocused(false) }}>
      <RadixPopover.Anchor asChild>
        <div className="relative flex items-center gap-[13px] bg-card px-4 py-3">
          {selected ? (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-sm font-extrabold text-white"
              style={{ backgroundColor: selected.brand_color ?? 'var(--account-slate)' }}
              aria-hidden
            >
              {(selected.name[0] ?? '?').toUpperCase()}
            </span>
          ) : (
            <FieldIcon>
              <Building2 className="size-[18px]" />
            </FieldIcon>
          )}
          <div className="min-w-0 flex-1">
            <FieldLabel>{label}</FieldLabel>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={(e) => {
                setFocused(true)
                // Pre-select the prefilled name so typing replaces it when switching.
                if (isPristineSelection) e.target.select()
              }}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={placeholder}
              aria-label={label}
              className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-medium placeholder:text-text-soft"
            />
          </div>
        </div>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Keep focus on the search input and let our blur logic own close-on-outside.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="z-50 max-h-[min(18rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-md border border-border bg-card shadow-md"
        >
          {filtered.map((inst) => (
            <button
              key={inst.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(inst)
                setFocused(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-page ${
                inst.id === institutionId ? 'bg-page font-semibold' : ''
              }`}
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
          {/* "+ Agregar" — always present; promoted (primary style + prefilled
              query) when the search has no matches. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openCreate(search.trim())}
            className={`flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm transition-colors ${
              noMatches
                ? 'bg-emerald-soft font-medium text-emerald-deep hover:bg-emerald-bg'
                : 'text-text-muted hover:bg-page hover:text-text'
            }`}
          >
            {noMatches
              ? t('customInstitution.add_with_query', { query: search.trim() })
              : t('customInstitution.add')}
          </button>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

// ── Inline custom-institution sub-form ──────────────────────────────────────────

const CustomInstitutionInlineForm = ({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string
  onCreated: (institution: Institution) => void
  onCancel: () => void
}) => {
  const t = useTranslations('accounts.customInstitution')
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState<AccountColorKey | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('errors.name_required')
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    if (!color) errs.color = t('errors.color_required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await createCustomInstitution({
        name: name.trim(),
        brand_color: ACCOUNT_COLOR_HEX[color!],
        icon_type: 'bank',
      })
      if (!result.ok) {
        if (result.fieldErrors?.name === 'duplicate') {
          setErrors({ name: t('errors.duplicate') })
          return
        }
        setFormError(result.formError ?? t('errors.create_failed'))
        return
      }
      if (result.institution) onCreated(result.institution)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-card p-4">
      <p className="text-sm font-bold text-text">{t('title_inline')}</p>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">{t('name_label')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('name_placeholder')}
          className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">{t('color_label')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {ACCOUNT_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-pressed={color === key}
              aria-label={key}
              className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                color === key ? 'ring-2 ring-ring' : ''
              }`}
              style={{ backgroundColor: ACCOUNT_COLOR_HEX[key] }}
            />
          ))}
        </div>
        {errors.color && <p className="text-xs text-destructive">{errors.color}</p>}
      </div>

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[10px] border border-border bg-card px-3 py-1.5 text-xs font-bold text-text transition-colors hover:bg-border-soft"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-[10px] bg-navy px-3 py-1.5 text-xs font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {t('create')}
        </button>
      </div>
    </div>
  )
}
