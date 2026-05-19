'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, X } from 'lucide-react'
import {
  acceptRecurrenceSuggestion,
  dismissRecurrenceSuggestion,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@/lib/format'
import { useShowCents } from '@/lib/preferences-context'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'semanal',
  biweekly: 'quincenal',
  monthly: 'mensual',
  annual: 'anual',
}

const MOVEMENT_LABEL: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
}

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

  const formatted =
    suggestion.currency_code === 'ARS'
      ? formatARS(suggestion.amount, showCents)
      : formatUSD(suggestion.amount, showCents)

  const movementLabel = MOVEMENT_LABEL[suggestion.movement_type] ?? '—'
  const freqLabel =
    FREQUENCY_LABEL[suggestion.frequency] ?? suggestion.frequency
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
        setError(result.formError ?? 'No se pudo crear la regla.')
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
        setError(result.formError ?? 'No se pudo descartar la sugerencia.')
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
            Parece que esto se repite
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
            Basado en {suggestion.occurrence_count} movimientos en los últimos 6 meses.
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
          {isPending ? 'Procesando…' : 'Crear regla'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
        >
          <X size={12} />
          Descartar
        </button>
      </div>
    </section>
  )
}
