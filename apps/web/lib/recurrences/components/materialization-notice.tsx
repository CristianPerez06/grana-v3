'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
export const MaterializationNotice = () => {
  const t = useTranslations('recurrences.materialization')
  const state = useRecurrenceMaterialization()

  if (!state) return null
  const { running, remaining, error, run } = state
  if (!error && remaining === 0) return null

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[13px] font-semibold text-text">{t('failed_title')}</p>
          <p className="text-[12px] text-text-soft">{t('failed_body')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={run} disabled={running}>
          {running ? t('running') : t('retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3">
      <RefreshCw
        className={`size-4 shrink-0 text-text-soft ${running ? 'animate-spin' : ''}`}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-[12px] text-text-soft">
        {t('remaining', { count: remaining })}
      </p>
      <Button size="sm" variant="ghost" onClick={run} disabled={running}>
        {running ? t('running') : t('continue')}
      </Button>
    </div>
  )
}
