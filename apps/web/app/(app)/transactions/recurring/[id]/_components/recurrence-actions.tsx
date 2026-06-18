'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Pencil, Play, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'
import {
  deleteRecurrence,
  pauseRecurrence,
  resumeRecurrence,
} from '@/app/_actions/recurrences'
import type { RecurrenceDetail } from '@/lib/recurrences/types'

type Props = {
  rule: RecurrenceDetail
  /** Opens the edit drawer (owned by the parent detail component). */
  onEdit: () => void
}

// Header actions for the recurrence detail, anchored top-right (A1 pattern):
// three direct icon-buttons — Edit / Pause-Resume (a single toggle keyed on
// status) / Delete. Edit defers to the parent (drawer); pause/resume and delete
// call their existing server actions. Delete confirms via a Radix AlertDialog
// (not a native confirm) with recurrence-contextual copy.
export const RecurrenceActions = ({ rule, onEdit }: Props) => {
  const t = useTranslations('recurrences')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isPaused = rule.status === 'paused'
  const isDeleted = rule.status === 'deleted'

  const handlePauseToggle = () => {
    setError(null)
    startTransition(async () => {
      const result = isPaused
        ? await resumeRecurrence(rule.id)
        : await pauseRecurrence(rule.id)
      if (!result.ok) {
        setError(result.formError ?? t('errors.status_change_failed'))
        return
      }
      router.refresh()
    })
  }

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteRecurrence(rule.id)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      setDeleteOpen(false)
      router.push('/transactions/recurring')
    })
  }

  const iconBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-text-muted transition-colors hover:bg-muted/40 hover:text-text disabled:opacity-40'

  return (
    <div className="flex items-center justify-end gap-1 px-3.5">
      <button
        type="button"
        onClick={onEdit}
        disabled={isPending || isDeleted}
        aria-label={t('actions.edit')}
        title={t('actions.edit')}
        className={iconBtn}
      >
        <Pencil size={17} strokeWidth={2} aria-hidden />
      </button>

      <button
        type="button"
        onClick={handlePauseToggle}
        disabled={isPending || isDeleted}
        aria-label={isPaused ? t('actions.resume') : t('actions.pause')}
        title={isPaused ? t('actions.resume') : t('actions.pause')}
        className={iconBtn}
      >
        {isPaused ? (
          <Play size={17} strokeWidth={2} aria-hidden />
        ) : (
          <Pause size={17} strokeWidth={2} aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        disabled={isPending || isDeleted}
        aria-label={t('actions.delete')}
        title={t('actions.delete')}
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-expense transition-colors hover:bg-expense/10 disabled:opacity-40"
      >
        <Trash2 size={17} strokeWidth={2} aria-hidden />
      </button>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-[16px] font-bold text-text">
              {t('actions.delete')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
              {t('confirmations.delete')}
            </AlertDialog.Description>
            {error && <p className="mt-3 text-[13px] text-expense">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50"
                >
                  {tCommon('cancel')}
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t('actions.delete_confirm')}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
