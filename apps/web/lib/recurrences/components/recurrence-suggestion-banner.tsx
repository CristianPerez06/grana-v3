'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  acceptRecurrenceSuggestion,
  dismissRecurrenceSuggestion,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'

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
  category: { id: string; name: string } | null
}

type Props = {
  suggestion: EnrichedSuggestion
}

export const RecurrenceSuggestionBanner = ({ suggestion }: Props) => {
  const router = useRouter()
  const showCents = useShowCents()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')

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
    suggestion.category?.name ||
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
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-start gap-2">
        <Repeat className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight">
            {t('suggestion.title')}
          </h2>
          <p className="text-sm">
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
          <p className="text-xs text-muted-foreground">
            {t('suggestion.basis', { count: suggestion.occurrence_count })}
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? t('suggestion.processing') : t('suggestion.create_rule')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
        >
          <X size={12} />
          {t('suggestion.dismiss')}
        </button>
      </div>
    </section>
  )
}
