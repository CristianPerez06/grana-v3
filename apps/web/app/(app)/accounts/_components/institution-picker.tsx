'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ACCOUNT_COLOR_HEX,
  ACCOUNT_COLOR_KEYS,
  type AccountColorKey,
} from '@grana/ui-contracts'
import { createCustomInstitution } from '@/app/_actions/institutions'
import type { Institution } from '@/lib/accounts/types'
import { cn } from '@/lib/utils'

type Props = {
  institutions: Institution[]
  selectedId: string
  initialSearch?: string
  onChange: (id: string, name: string) => void
  errorText?: string
}

/**
 * Institution input with autocomplete dropdown and inline custom-creation
 * sub-form. Used by both the create and edit account forms. The dropdown shows
 * catalog + user custom institutions (filtered by RLS upstream); each option
 * carries a brand-color chip with the institution's initial. The "+ Add new"
 * item is always present at the end of the dropdown and is promoted as the
 * primary CTA when the search has 0 matches.
 */
export const InstitutionPicker = ({
  institutions,
  selectedId,
  initialSearch = '',
  onChange,
  errorText,
}: Props) => {
  const t = useTranslations('accounts')
  const [search, setSearch] = useState(initialSearch)
  const [focused, setFocused] = useState(false)
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [createPrefill, setCreatePrefill] = useState('')

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  )
  const noMatches = filtered.length === 0 && search.trim().length > 0
  const showDropdown = focused && !selectedId && mode === 'list'

  const openCreate = (prefill: string) => {
    setCreatePrefill(prefill)
    setMode('create')
    setFocused(false)
  }

  const handleCreated = (institution: Institution) => {
    setSearch(institution.name)
    setMode('list')
    onChange(institution.id, institution.name)
  }

  const handleCancel = () => {
    setMode('list')
    setCreatePrefill('')
  }

  if (mode === 'create') {
    return (
      <CustomInstitutionInlineForm
        initialName={createPrefill}
        onCreated={handleCreated}
        onCancel={handleCancel}
      />
    )
  }

  const selectedInstitution = selectedId
    ? institutions.find((i) => i.id === selectedId) ?? null
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        {selectedInstitution && (
          <span
            className="pointer-events-none absolute left-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
            style={{ backgroundColor: selectedInstitution.brand_color ?? 'var(--account-slate)' }}
            aria-hidden
          >
            {(selectedInstitution.name[0] ?? '?').toUpperCase()}
          </span>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            const value = e.target.value
            setSearch(value)
            if (selectedId) {
              const sel = institutions.find((i) => i.id === selectedId)
              if (sel && sel.name !== value) onChange('', value)
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay blur so click on a dropdown option still registers.
            setTimeout(() => setFocused(false), 150)
          }}
          placeholder={t('placeholders.institutionSearch')}
          className={cn(
            'w-full rounded-md border border-input bg-background py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            selectedInstitution ? 'pl-10 pr-3' : 'px-3',
          )}
        />
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-input bg-background shadow-md">
            {filtered.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(inst.id, inst.name)
                  setSearch(inst.name)
                  setFocused(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: inst.brand_color ?? 'var(--account-slate)' }}
                  aria-hidden
                >
                  {(inst.name[0] ?? '?').toUpperCase()}
                </span>
                <span>{inst.name}</span>
              </button>
            ))}
            {/* "+ Add new" item — always present at the end; promoted (primary
                style + prefilled query) when there are no matches. */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openCreate(search.trim())}
              className={cn(
                'flex w-full items-center gap-2 border-t border-input px-3 py-2 text-left text-sm transition-colors',
                noMatches
                  ? 'bg-primary/5 font-medium text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {noMatches ? t('customInstitution.add_with_query', { query: search.trim() }) : t('customInstitution.add')}
            </button>
          </div>
        )}
      </div>
      {errorText && <p className="text-xs text-destructive">{errorText}</p>}
    </div>
  )
}

// ── Inline sub-form ────────────────────────────────────────────────────────────

type SubFormProps = {
  initialName: string
  onCreated: (institution: Institution) => void
  onCancel: () => void
}

const CustomInstitutionInlineForm = ({ initialName, onCreated, onCancel }: SubFormProps) => {
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
        // Default to the bank icon for all custom institutions — the
        // distinction with `wallet` was decorative and added cognitive load
        // without product value. If finer-grained icon control is needed
        // later, expose a separate icon picker.
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
    <div className="flex flex-col gap-3 rounded-md border border-input bg-muted/30 p-3">
      <p className="text-sm font-medium text-foreground">{t('title_inline')}</p>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('name_label')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('name_placeholder')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{t('color_label')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {ACCOUNT_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-pressed={color === key}
              aria-label={key}
              className={cn(
                'h-7 w-7 rounded-md ring-offset-2 ring-offset-background transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                color === key && 'ring-2 ring-ring',
              )}
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
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {t('create')}
        </button>
      </div>
    </div>
  )
}
