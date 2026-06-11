'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'

type SaveResult = { ok: boolean; formError?: string }

type Props = {
  open: boolean
  onClose: () => void
  firstName: string
  secondName: string
  initialFirstPct: number
  onSave: (firstPct: number) => Promise<SaveResult>
}

/**
 * Focused drawer to edit the household default split. Only the first member's
 * percentage is editable; the second is the derived complement (`100 - first`),
 * shown readonly — the same rule the page enforces. The parent supplies
 * `onSave`, which builds the `default_split` payload and runs the existing
 * `updateHouseholdConfig({ default_split })` mutation. Cancel / scrim / Esc
 * close without mutating.
 */
export function DefaultSplitEditDrawer({
  open,
  onClose,
  firstName,
  secondName,
  initialFirstPct,
  onSave,
}: Props) {
  const t = useTranslations('shared')
  const tCommon = useTranslations('common')

  const [firstPct, setFirstPct] = useState(initialFirstPct)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const title = t('settings.split_drawer_title')

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const r = await onSave(firstPct)
    setSubmitting(false)
    if (r.ok) onClose()
    else setError(r.formError ?? 'Error')
  }

  return (
    <Drawer open={open} onClose={onClose} widthPx={480} ariaLabel={title}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-7 pb-5 pt-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">
                {t('settings.drawer_eyebrow')}
              </p>
              <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-[22px]">
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
          <p className="mb-4 text-xs text-text-muted">{t('settings.default_split_hint')}</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-text">{firstName}</span>
                <span className="truncate text-xs font-medium text-text-muted">
                  {t('settings.default_split_first_label')}
                </span>
              </span>
              <Input
                type="number"
                min={1}
                max={99}
                value={firstPct}
                onChange={(e) =>
                  setFirstPct(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                }
                className="w-20 text-center tabular-nums"
                aria-label={firstName}
                autoFocus
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-text">{secondName}</span>
                <span className="truncate text-xs font-medium text-text-muted">
                  {t('settings.default_split_complement_label')}
                </span>
              </span>
              <span className="inline-flex h-11 w-20 items-center justify-center text-sm font-semibold tabular-nums text-text-muted">
                {100 - firstPct}%
              </span>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-7 py-4">
          <Button type="button" variant="secondary" onClick={onClose} className="w-auto px-5">
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            loading={submitting}
            className="flex-1"
          >
            {tCommon('save')}
          </Button>
        </footer>
      </div>
    </Drawer>
  )
}
