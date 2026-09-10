'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { materializationOutcome } from '@grana/recurrences'
import { Button } from '@/components/ui/button'
import { useRecurrenceMaterialization } from '@/lib/recurrences/materialization-context'

/**
 * What the materialization did, when it is not "everything is up to date".
 *
 * Two states, and the point of both is that neither may look like an empty
 * screen. A failure used to be swallowed, leaving the user with a page identical
 * to somebody with nothing to review — the opposite claim to the true one. And a
 * run that still owes occurrences has to say so and offer to continue, because a
 * year of daily backlog takes several runs.
 *
 * Renders nothing when there is nothing to say, and nothing at all outside the
 * provider.
 */
/** A failure, with the one thing the user can do about it. */
export const RecurrenceFailureNotice = ({
  title,
  body,
  onRetry,
  retrying,
  className,
}: {
  title: string
  body: string
  onRetry: () => void
  retrying: boolean
  className?: string
}) => {
  const t = useTranslations('recurrences.materialization')
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 ${className ?? ''}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] font-semibold text-text">{title}</p>
        <p className="text-[12px] text-text-soft">{body}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onRetry} disabled={retrying}>
        {retrying ? t('running') : t('retry')}
      </Button>
    </div>
  )
}

export const MaterializationNotice = ({ className }: { className?: string }) => {
  const t = useTranslations('recurrences.materialization')
  const state = useRecurrenceMaterialization()

  if (!state) return null
  const { running, run } = state
  const outcome = materializationOutcome(state)
  if (outcome.kind === 'quiet') return null

  if (outcome.kind === 'failed') {
    return (
      <RecurrenceFailureNotice
        className={className}
        title={t('failed_title')}
        body={t('failed_body')}
        onRetry={run}
        retrying={running}
      />
    )
  }

  return (
    // Stacks under `sm`: on a phone-width viewport the sentence and the action
    // side by side leave each other a few characters, and the label is the half
    // that gets clipped. Same shape as native, for the same reason.
    <div
      className={`flex flex-col items-stretch gap-2 rounded-xl border border-border bg-surface-soft px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${className ?? ''}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <RefreshCw
          className={`size-4 shrink-0 text-text-soft ${running ? 'animate-spin' : ''}`}
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-[12px] text-text-soft">
          {t('remaining', { count: outcome.count })}
        </p>
      </div>
      <Button className="shrink-0" size="sm" variant="ghost" onClick={run} disabled={running}>
        {running ? t('running') : t('continue')}
      </Button>
    </div>
  )
}
