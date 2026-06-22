'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Repeat, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  acceptRecurrenceSuggestion,
  dismissRecurrenceSuggestion,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { getCategoryName } from '@/lib/categories/display'
import { Button } from '@/components/ui/button'
import { invalidateAfterSuggestionMutation } from '@/lib/transactions/invalidation'

type EnrichedSuggestion = {
  fingerprint: string
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  currency_code: string
  amount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'annual'
  start_date: string
  description: string | null
  occurrence_count: number
  account: { id: string; name: string; type: 'cash' | 'bank' | 'credit' } | null
  destination_account: { id: string; name: string } | null
  category: { id: string; name: string; canonical_name: string; user_id: string | null } | null
  total_pending: number
}

type Props = {
  suggestion: EnrichedSuggestion
}

export const RecurrenceSuggestionBanner = ({ suggestion }: Props) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // One suggestion shows at a time; `total_pending` counts how many are queued
  // behind it. With a single one we open directly; with 2+ we start collapsed so
  // the banner stays a thin header above the spending card until the user opens
  // it (confirming/dismissing reveals the next, re-evaluating this default).
  const hasMore = suggestion.total_pending > 1
  const [isOpen, setIsOpen] = useState(!hasMore)
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const tRoot = useTranslations()

  const formatted =
    suggestion.currency_code === 'ARS'
      ? formatARS(suggestion.amount, showCents)
      : formatUSD(suggestion.amount, showCents)

  const movementLabel = tTx(
    `types.${suggestion.movement_type}` as 'types.income',
  )
  const freqLabel = t(
    `frequencies_lower.${suggestion.frequency}` as 'frequencies_lower.weekly',
  )
  const title =
    suggestion.description ||
    (suggestion.category ? getCategoryName(suggestion.category, tRoot) : null) ||
    movementLabel
  const accountName = suggestion.account?.name ?? '—'
  const destinationName = suggestion.destination_account?.name

  const handleAccept = () => {
    setError(null)
    startTransition(async () => {
      const result = await acceptRecurrenceSuggestion({
        movement_type: suggestion.movement_type,
        account_id: suggestion.account_id,
        transfer_destination_account_id: suggestion.destination_account_id,
        category_id: suggestion.category_id,
        currency_code: suggestion.currency_code,
        amount: suggestion.amount,
        frequency: suggestion.frequency,
        start_date: suggestion.start_date,
        description: suggestion.description,
        fingerprint: suggestion.fingerprint,
      })
      if (!result.ok) {
        setError(result.formError ?? t('errors_extra.create_rule_failed'))
        return
      }
      invalidateAfterSuggestionMutation(queryClient)
      router.refresh()
    })
  }

  const handleDismiss = () => {
    setError(null)
    startTransition(async () => {
      const result = await dismissRecurrenceSuggestion({
        fingerprint: suggestion.fingerprint,
      })
      if (!result.ok) {
        setError(result.formError ?? t('errors_extra.dismiss_failed'))
        return
      }
      invalidateAfterSuggestionMutation(queryClient)
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col rounded-md border border-slate/20 bg-slate-soft text-slate">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-md p-4 text-left transition-colors hover:bg-slate/10"
      >
        <Repeat className="size-4 shrink-0 text-slate" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight text-slate-deep">
          {t('suggestion.title')}
        </h2>
        {hasMore && (
          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate/15 px-1.5 text-xs font-semibold text-slate-deep">
            {suggestion.total_pending}
          </span>
        )}
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-slate transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 px-4 pb-4 pl-10">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-text">
              <span className="font-medium">{title}</span>
              {' · '}
              {suggestion.movement_type === 'transfer'
                ? `${accountName} → ${destinationName ?? '—'}`
                : accountName}
              {' · '}
              <span className="font-semibold">{formatted}</span>
              {' · '}
              {freqLabel}
            </p>
            <p className="text-xs text-slate/80">
              {t('suggestion.basis', { count: suggestion.occurrence_count })}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-auto"
              onClick={handleAccept}
              disabled={isPending}
              loading={isPending}
            >
              {t('suggestion.create_rule')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-auto"
              onClick={handleDismiss}
              disabled={isPending}
            >
              <X size={12} />
              {t('suggestion.dismiss')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
