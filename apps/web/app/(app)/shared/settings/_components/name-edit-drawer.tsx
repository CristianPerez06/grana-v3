'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SaveResult = { ok: boolean; formError?: string }

type Props = {
  open: boolean
  onClose: () => void
  initialName: string
  onSave: (name: string) => Promise<SaveResult>
}

/**
 * Focused drawer to edit the household name. Owns its own draft + submit state
 * (mirroring `LeaveHouseholdDialog`); the parent supplies `onSave`, which runs
 * the existing `updateHouseholdConfig({ name })` mutation and refreshes. The
 * parent remounts this via `key` on open so the draft re-seeds from the current
 * name. Cancel / scrim / Esc close without mutating.
 */
export function NameEditDrawer({ open, onClose, initialName, onSave }: Props) {
  const t = useTranslations('shared')
  const tCommon = useTranslations('common')

  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const title = t('settings.name_drawer_title')

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const r = await onSave(name.trim())
    setSubmitting(false)
    if (r.ok) onClose()
    else setError(r.formError ?? 'Error')
  }

  return (
    <Drawer open={open} onClose={onClose} widthPx={480} ariaLabel={title}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-5 pb-5 pt-[22px] sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">
                {t('settings.drawer_eyebrow')}
              </p>
              <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-text sm:text-[25px]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tCommon('cancel')}
              className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text transition-colors hover:bg-border-soft"
            >
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-[22px] sm:px-7">
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="household-name" className="text-xs text-text-muted">
              {t('setup.name_label')}
            </Label>
            <Input
              id="household-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-5 py-4 sm:px-7">
          <Button type="button" variant="secondary" onClick={onClose} className="w-auto px-5">
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            loading={submitting}
            disabled={!name.trim()}
            className="flex-1"
          >
            {tCommon('save')}
          </Button>
        </footer>
      </div>
    </Drawer>
  )
}
